// Importing utilities
const chai = require("chai")
const fs = require("fs")

const { poseidonContract, buildPoseidon } = require("circomlibjs")
const { ethers } = require("hardhat")
const { groth16 } = require("snarkjs")
const { utils } = require("ffjavascript")
const { stringifyBigInts, unstringifyBigInts } = utils

const { MerkleTree } = require("fixed-merkle-tree")
const { ContractFactory } = require("ethers")
const { assert } = require("chai")
const { expect } = require("chai")

const ETH_AMOUNT = ethers.utils.parseEther("10")
const MAX_AMOUNT = ethers.utils.parseEther("10000")
const HEIGHT = 20
const ZERO_VALUE = "21663839004416932945382355908790599225266501822907911457504978515578255421292"

// Generates the poseidon hash contract and contract factory
// @params {Number} nInputs - number of poseidon inputs

function getPoseidonFactory(nInputs){
  const bytecode = poseidonContract.createCode(nInputs)
  const abiJson = poseidonContract.generateABI(nInputs)
  const abi = new ethers.utils.Interface(abiJson)
  return new ContractFactory(abi, bytecode)
}

// Generates and returns the Deposit details
async function generateDeposit(...args){
  const poseidon = await buildPoseidon();

  const deposit = {
    secret: ethers.utils.randomBytes(31),
    nullifier: ethers.utils.randomBytes(31),
    amount: ETH_AMOUNT
  }

  let commit

  if(args.length > 0){
    commit = poseidon([
      ethers.BigNumber.from(deposit.nullifier).toBigInt(),
      ethers.BigNumber.from(deposit.secret).toBigInt(),
      args[0]
    ])
  }
  else{
    commit = poseidon([
      ethers.BigNumber.from(deposit.nullifier).toBigInt(),
      ethers.BigNumber.from(deposit.secret).toBigInt(),
      deposit.amount
    ])
  }
  
  deposit.commitment = poseidon.F.toString(commit)

  return deposit
}


describe("MyCryptoStash", function(){
  this.timeout(1000000)
  let poseidonContract
  let myCryptoStash
  let verifier
  let poseidon

  // builds the poseidon hasher before the whole test
  before(async function (){
    poseidon = await buildPoseidon()
  })

  // Hashes the parameter(s) and returns the string of the poseidon hash
  const poseidonHash = (...args) => {
    const hash = poseidon(args)
    const hashStr = poseidon.F.toString(hash)
    return hashStr
  }

  // Deploys the necessary smart contracts before each test
  beforeEach(async function () {
    const [signer] = await ethers.getSigners()
    const Verifier = await ethers.getContractFactory("Verifier", signer)
    verifier = await Verifier.deploy()
    poseidonContract = await getPoseidonFactory(2).connect(signer).deploy() // deploys poseidon contract
    const MyCryptoStash = await ethers.getContractFactory("ETHMyCryptoStash", signer)
    myCryptoStash = await MyCryptoStash.deploy(poseidonContract.address, ETH_AMOUNT, MAX_AMOUNT, HEIGHT, verifier.address) // deploys app contract
  });

  it("generates same poseidon hash", async function (){
    const res = await poseidonContract["poseidon(uint256[2])"]([1, 2])
    const res2 = poseidon([1, 2])

    chai.assert.equal(res.toString(), poseidon.F.toString(res2))
  })

  it("should deposit", async () => {

    // Generates the deposit data and deposits the commitment
    const [signer] = await ethers.getSigners()
    const deposit = await generateDeposit()
    const commitmentStr =  deposit.commitment

    const tx = await myCryptoStash.connect(signer).deposit(commitmentStr, ETH_AMOUNT, { value: ETH_AMOUNT })

    // Listens to the emitted event on the blockchain and checks if the deposited commitment == original commitment
    const receipt = await tx.wait()
    const events = await myCryptoStash.queryFilter(myCryptoStash.filters.Deposit(), receipt.blockhash)
    chai.assert.equal(events[0].args.commitment, commitmentStr)
    console.log("Deposit gas cost", receipt.gasUsed.toNumber())
    deposit.leafIndex = events[0].args.leafIndex
    const elements = await myCryptoStash.callStatic.getCommitments()
    console.log(stringifyBigInts(elements))

    // Checks if the root is generated correctly
    const tree = new MerkleTree(HEIGHT, [], { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })
    chai.assert.equal(tree.root, await myCryptoStash.roots(0))
    tree.insert(commitmentStr)
    assert.equal(tree.elements.length, await myCryptoStash.nextIndex())
    assert.equal(tree.root, await myCryptoStash.roots(1))

  })

  it("should withdraw", async () => {
    // User deposits
    const deposit = await generateDeposit()
    const commitmentStr =  deposit.commitment
    const [signer, relayerSigner, newSigner] = await ethers.getSigners()
    await myCryptoStash.connect(signer).deposit(commitmentStr, ETH_AMOUNT, { value: ETH_AMOUNT })
    const tree = new MerkleTree(HEIGHT, [], { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })
    tree.insert(commitmentStr)

    // Gathering withdrawal data
    const depositIndex = tree.indexOf(commitmentStr)
    const nullifierHash = poseidonHash(ethers.BigNumber.from(deposit.nullifier).toBigInt(), 1, depositIndex)
    const recipient = await newSigner.getAddress()
    const relayer = await relayerSigner.getAddress()
    const fee = 0
    const withdrawAmount = ETH_AMOUNT

    const { pathElements, pathIndices, pathRoot } = tree.path(depositIndex)
    // const now = Date.now()
    const nullifier = ethers.BigNumber.from(deposit.nullifier).toBigInt()
    const secret = ethers.BigNumber.from(deposit.secret).toBigInt()

    // Generates the proof for the withdrawal
    const input = stringifyBigInts({
      // Public inputs
      "root": pathRoot,
      nullifierHash,
      recipient,
      relayer,
      fee,
      withdrawAmount,
      // Private inputs
      "amount": deposit.amount,
      "nullifier": nullifier,
      "secret": secret,
      "pathElements": pathElements,
      "pathIndices": pathIndices,
    })

    const { proof, publicSignals } = await groth16.fullProve(input, "circuits/withdraw/withdraw_js/withdraw.wasm", "circuits/withdraw/circuit_final.zkey")

    const editedProof = unstringifyBigInts(proof)
    const editedPublicSignals = unstringifyBigInts(publicSignals)
    const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals)
    const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());
    const _proof = {
        a: [argv[0], argv[1]],
        b: [[argv[2], argv[3]], [argv[4], argv[5]]],
        c: [argv[6], argv[7]],
    }
    
    // Withdraws from app contract.
    const txWithdraw = await myCryptoStash.connect(relayerSigner).withdraw(_proof, pathRoot, nullifierHash, recipient, relayer, fee, withdrawAmount)
    const receiptWithdraw = await txWithdraw.wait()
    console.log("Withdraw gas cost", receiptWithdraw.gasUsed.toNumber())
  })

  it("should reject double spending", async () => {
    const deposit = await generateDeposit()
    const commitmentStr =  deposit.commitment
    const [signer, relayerSigner, newSigner] = await ethers.getSigners()
    await myCryptoStash.connect(signer).deposit(commitmentStr, ETH_AMOUNT, { value: ETH_AMOUNT })
    const tree = new MerkleTree(HEIGHT, [], { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })
    tree.insert(commitmentStr)

    const depositIndex = tree.indexOf(commitmentStr)
    const nullifierHash = poseidonHash(ethers.BigNumber.from(deposit.nullifier).toBigInt(), 1, depositIndex)
    const recipient = await newSigner.getAddress()
    const relayer = await relayerSigner.getAddress()
    const fee = 0
    const withdrawAmount = ETH_AMOUNT

    const { pathElements, pathIndices, pathRoot } = tree.path(depositIndex)
    // const now = Date.now()
    const nullifier = ethers.BigNumber.from(deposit.nullifier).toBigInt()
    const secret = ethers.BigNumber.from(deposit.secret).toBigInt()
    const input = stringifyBigInts({
      // Public inputs
      "root": pathRoot,
      nullifierHash,
      recipient,
      relayer,
      fee,
      withdrawAmount,
      // Private inputs
      "amount": deposit.amount,
      "nullifier": nullifier,
      "secret": secret,
      "pathElements": pathElements,
      "pathIndices": pathIndices,
    })

    const { proof, publicSignals } = await groth16.fullProve(input, "circuits/withdraw/withdraw_js/withdraw.wasm", "circuits/withdraw/circuit_final.zkey")

    const editedProof = unstringifyBigInts(proof)
    const editedPublicSignals = unstringifyBigInts(publicSignals)
    const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals)
    const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());
    const _proof = {
        a: [argv[0], argv[1]],
        b: [[argv[2], argv[3]], [argv[4], argv[5]]],
        c: [argv[6], argv[7]],
    }
    
    // Withdraws from app contract.
    await myCryptoStash.connect(relayerSigner).withdraw(_proof, pathRoot, nullifierHash, recipient, relayer, fee, withdrawAmount)
    await myCryptoStash.connect(relayerSigner).withdraw(_proof, pathRoot, nullifierHash, recipient, relayer, fee, withdrawAmount).then(
      () => {
        assert.fail("Expect tx to fail")
      }, (error) => {
        expect(error.message).to.have.string("The note has been already spent.")
      }
    )
  }).timeout(500000)

  it("should withdraw partial amount", async () => {
    const withdrawAmount = ethers.utils.parseEther("0.05")
    const deposit = await generateDeposit()
    const commitmentStr =  deposit.commitment
    const [signer, relayerSigner, newSigner] = await ethers.getSigners()
    await myCryptoStash.connect(signer).deposit(commitmentStr, deposit.amount, { value: ETH_AMOUNT })
    const tree = new MerkleTree(HEIGHT, [], { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })
    tree.insert(commitmentStr)

    const depositIndex = tree.indexOf(commitmentStr)
    const nullifierHash = poseidonHash(ethers.BigNumber.from(deposit.nullifier).toBigInt(), 1, depositIndex)
    const recipient = await newSigner.getAddress()
    const relayer = await relayerSigner.getAddress()
    const fee = 0

    const { pathElements, pathIndices, pathRoot } = tree.path(depositIndex)
    // const now = Date.now()
    const nullifier = ethers.BigNumber.from(deposit.nullifier).toBigInt()
    const secret = ethers.BigNumber.from(deposit.secret).toBigInt()
    const input = stringifyBigInts({
      // Public inputs
      "root": pathRoot,
      nullifierHash,
      recipient,
      relayer,
      fee,
      withdrawAmount,
      // Private inputs
      "amount": deposit.amount,
      "nullifier": nullifier,
      "secret": secret,
      "pathElements": pathElements,
      "pathIndices": pathIndices,
    })

    const { proof, publicSignals } = await groth16.fullProve(input, "circuits/withdraw/withdraw_js/withdraw.wasm", "circuits/withdraw/circuit_final.zkey")

    const editedProof = unstringifyBigInts(proof)
    const editedPublicSignals = unstringifyBigInts(publicSignals)
    const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals)
    const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());
    const _proof = {
        a: [argv[0], argv[1]],
        b: [[argv[2], argv[3]], [argv[4], argv[5]]],
        c: [argv[6], argv[7]],
    }
    

    const remainder = await generateDeposit(deposit.amount - withdrawAmount)

    const txWithdraw = await myCryptoStash.connect(relayerSigner).partialWithdraw(_proof, pathRoot, nullifierHash, recipient, relayer, fee, withdrawAmount, remainder.commitment)
    const receiptWithdraw = await txWithdraw.wait()
    console.log("Withdraw gas cost", receiptWithdraw.gasUsed.toNumber())

  }).timeout(500000)

  it("should reject withdrawal of remaining funds if withdraw amount is higher than remaining amount", async () => {
    let withdrawAmount = ethers.utils.parseEther("0.05")
    const deposit = await generateDeposit()
    const commitmentStr =  deposit.commitment
    const [signer, relayerSigner, newSigner] = await ethers.getSigners()
    await myCryptoStash.connect(signer).deposit(commitmentStr, deposit.amount, { value: ETH_AMOUNT })
    const tree = new MerkleTree(HEIGHT, [], { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })
    tree.insert(commitmentStr)

    let depositIndex = tree.indexOf(commitmentStr)
    let nullifierHash = poseidonHash(ethers.BigNumber.from(deposit.nullifier).toBigInt(), 1, depositIndex)
    const recipient = await newSigner.getAddress()
    const relayer = await relayerSigner.getAddress()
    const fee = 0

    const { pathElements, pathIndices, pathRoot } = tree.path(depositIndex)
    // const now = Date.now()
    const nullifier = ethers.BigNumber.from(deposit.nullifier).toBigInt()
    const secret = ethers.BigNumber.from(deposit.secret).toBigInt()
    const input = stringifyBigInts({
      // Public inputs
      "root": pathRoot,
      nullifierHash,
      recipient,
      relayer,
      fee,
      withdrawAmount,
      // Private inputs
      "amount": deposit.amount,
      "nullifier": nullifier,
      "secret": secret,
      "pathElements": pathElements,
      "pathIndices": pathIndices,
    })

    const { proof, publicSignals } = await groth16.fullProve(input, "circuits/withdraw/withdraw_js/withdraw.wasm", "circuits/withdraw/circuit_final.zkey")

    const editedProof = unstringifyBigInts(proof)
    const editedPublicSignals = unstringifyBigInts(publicSignals)
    const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals)
    const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());
    const _proof = {
        a: [argv[0], argv[1]],
        b: [[argv[2], argv[3]], [argv[4], argv[5]]],
        c: [argv[6], argv[7]],
    }
    const remainder = await generateDeposit(deposit.amount - withdrawAmount)

    await myCryptoStash.connect(relayerSigner).partialWithdraw(_proof, pathRoot, nullifierHash, recipient, relayer, fee, withdrawAmount, remainder.commitment)

    tree.insert(remainder.commitment)

    withdrawAmount = ethers.utils.parseEther("0.06")
    depositIndex = tree.indexOf(commitmentStr)
    nullifierHash = poseidonHash(ethers.BigNumber.from(remainder.nullifier).toBigInt(), 1, depositIndex)
    const {pathElements: pathElements2, pathIndices: pathIndices2, pathRoot: pathRoot2 } = tree.path(depositIndex)

    const nullifier2 = ethers.BigNumber.from(deposit.nullifier).toBigInt()
    const secret2 = ethers.BigNumber.from(deposit.secret).toBigInt()
    const input2 = stringifyBigInts({
      // Public inputs
      "root": pathRoot2,
      nullifierHash,
      recipient,
      relayer,
      fee,
      withdrawAmount,
      // Private inputs
      "amount": remainder.amount,
      "nullifier": nullifier2,
      "secret": secret2,
      "pathElements": pathElements2,
      "pathIndices": pathIndices2,
    })

    await groth16.fullProve(input2, "circuits/withdraw/withdraw_js/withdraw.wasm", "circuits/withdraw/circuit_final.zkey").then(
      () => {
        assert.fail("Expect proof gen to fail")
      }, (error) => {
        expect(error.message).to.have.string("Error: Assert Failed.")
      }
    )
  }).timeout(500000)
})

//     // await plonk.fullProve(input, "circuits/withdraw_plonk/withdraw_js/withdraw.wasm", "circuits/withdraw_plonk/circuit_final.zkey").then(
//     //   () => {
//     //     assert.fail("Expect proof gen to fail")
//     //   }, (error) => {
//     //     expect(error.message).to.have.string("Error: Assert Failed.")
//     //   }
//     // )