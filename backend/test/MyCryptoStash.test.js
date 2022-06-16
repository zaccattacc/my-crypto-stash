const chai = require("chai")
const fs = require("fs")

const { toBN } = require('web3-utils')
const { poseidonContract, buildPoseidon } = require("circomlibjs")
const { ethers } = require("hardhat")
const { plonk } = require("snarkjs")
const { utils } = require("ffjavascript")
const { stringifyBigInts } = utils

const crypto = require("crypto")
const { MerkleTree } = require("fixed-merkle-tree")
const { ContractFactory } = require("ethers")

const rbigint = (nbytes) => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes))

const ETH_AMOUNT = ethers.utils.parseEther("0.1");
const HEIGHT = 20
const ZERO_VALUE = "21663839004416932945382355908790599225266501822907911457504978515578255421292"


function getPoseidonFactory(nInputs){
  const bytecode = poseidonContract.createCode(nInputs)
  const abiJson = poseidonContract.generateABI(nInputs)
  const abi = new ethers.utils.Interface(abiJson)
  return new ContractFactory(abi, bytecode)
}

async function generateDeposit(){
  let poseidon = await buildPoseidon();

  let deposit = {
    secret: ethers.utils.randomBytes(31),
    nullifier: ethers.utils.randomBytes(31),
  }
  
  const commit = poseidon([ethers.BigNumber.from(deposit.nullifier).toBigInt(), ethers.BigNumber.from(deposit.secret).toBigInt()])
  deposit.commitment = commit

  return deposit
}

describe("MyCryptoStash", function(){
  let poseidonContract
  let myCryptoStash
  let verifier
  let poseidon

  before(async function (){
    poseidon = await buildPoseidon()
  })

  const poseidonHash2 = (...args) => {
    const hash = poseidon(args)
    const hashStr = poseidon.F.toString(hash)
    return hashStr
  }


  beforeEach(async function () {
    const [signer] = await ethers.getSigners()
    const Verifier = await ethers.getContractFactory("PlonkVerifier", signer)
    verifier = await Verifier.deploy()
    poseidonContract = await getPoseidonFactory(2).connect(signer).deploy()
    const MyCryptoStash = await ethers.getContractFactory("ETHMyCryptoStash", signer)
    myCryptoStash = await MyCryptoStash.deploy(poseidonContract.address, ETH_AMOUNT, HEIGHT, verifier.address)
  });

  it("generates same poseidon hash", async function (){
    const res = await poseidonContract["poseidon(uint256[2])"]([1, 2])
    const res2 = poseidon([1, 2])

    chai.assert.equal(res.toString(), poseidon.F.toString(res2))
  }).timeout(100000);

  it("should deposit", async () => {

    const [signer] = await ethers.getSigners()
    const deposit = await generateDeposit()
    const commitmentStr =  poseidon.F.toString(deposit.commitment)

    const tx = await myCryptoStash.connect(signer).deposit(commitmentStr, { value: ETH_AMOUNT })
    const receipt = await tx.wait()
    const events = await myCryptoStash.queryFilter(myCryptoStash.filters.Deposit(), receipt.blockhash)
    chai.assert.equal(events[0].args.commitment, commitmentStr)
    console.log("Deposit gas cost", receipt.gasUsed.toNumber())
    deposit.leafIndex = events[0].args.leafIndex

    const tree = new MerkleTree(HEIGHT, [], { hashFunction: poseidonHash2, zeroElement: ZERO_VALUE })
    chai.assert.equal(tree.root, await myCryptoStash.roots(0))
    tree.insert(commitmentStr)
    chai.assert.equal(tree.elements.length, await myCryptoStash.nextIndex())
    chai.assert.equal(tree.root, await myCryptoStash.roots(1))

  })

  it("should withdraw", async () => {
    const deposit = await generateDeposit()
    const commitmentStr =  poseidon.F.toString(deposit.commitment)
    const [signer, relayerSigner, newSigner] = await ethers.getSigners()
    const tree = new MerkleTree(HEIGHT, [], { hashFunction: poseidonHash2, zeroElement: ZERO_VALUE })
    tree.insert(commitmentStr)

    const depositIndex = tree.indexOf(commitmentStr)
    const nullifierHash = poseidonHash2(ethers.BigNumber.from(deposit.nullifier).toBigInt(), 1, depositIndex)
    const recipient = await newSigner.getAddress()
    const relayer = await relayerSigner.getAddress()
    const fee = 0

    const { pathElements, pathIndices, pathPositions, pathRoot } = tree.path(depositIndex)
    const now = Date.now()
    const nullifier = ethers.BigNumber.from(deposit.nullifier).toBigInt()
    const secret = ethers.BigNumber.from(deposit.secret).toBigInt()
    const input = stringifyBigInts({
      // Public inputs
      "root": pathRoot,
      "nullifierHash": nullifierHash,
      "recipient": recipient,
      "relayer": relayer,
      "fee": fee,
      "currentTime": now,
      // Private inputs
      "toBeUnlocked": now,
      "nullifier": nullifier,
      "secret": secret,
      "pathElements": pathElements,
      "pathIndices":pathIndices,
    })

    const { proof } = await plonk.fullProve(input, "circuits/withdraw_plonk/withdraw_js/withdraw.wasm", "circuits/withdraw_plonk/circuit_final.zkey")
    for(element in pathElements){
      console.log(typeof(element))
    }
  })
})