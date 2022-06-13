const chai = require("chai")
const fs = require("fs")

const { toBN } = require('web3-utils')
const { poseidonContract, buildPoseidon } = require("circomlibjs")
const { ethers } = require("hardhat")
const snarkjs = require("snarkjs")
const bigInt = snarkjs.bigInt
const { plonk } = require("snarkjs")

const crypto = require("crypto")
const MerkleTree = require("fixed-merkle-tree")
const { ContractFactory } = require("ethers")

const rbigint = (nbytes) => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes))

const ETH_AMOUNT = ethers.utils.parseEther("0.1");
const HEIGHT = 20


function getPoseidonFactory(nInputs){
  const bytecode = poseidonContract.createCode(nInputs)
  const abiJson = poseidonContract.generateABI(nInputs)
  const abi = new ethers.utils.Interface(abiJson)
  return new ContractFactory(abi, bytecode)
}

async function generateDeposit(){
  let poseidon = await buildPoseidon();

  let deposit = {
    secret: rbigint(31),
    nullifier: rbigint(31),
  }

  deposit.commitment = poseidon([deposit.nullifier, deposit.secret])
}

describe("Tornado", function(){
  let poseidonContract

  before(async () => {
    poseidon = await buildPoseidon()
  })

  beforeEach(async function () {
    const [signer] = await ethers.getSigners()
    const Verifier = await ethers.getContractFactory("PlonkVerifier", signer)
    const verifier = await Verifier.deploy()
    poseidonContract = await getPoseidonFactory(2).connect(signer).deploy()
    const MyCryptoStash = await ethers.getContractFactory("ETHMyCryptoStash", signer)
    const myCryptoStash = await MyCryptoStash.deploy(poseidonContract.address, ETH_AMOUNT, HEIGHT)
  });

  it("generates same poseidon hash", async function (){
    const res = await poseidonContract["poseidon(uint256[2])"]([1, 2])
    const res2 = poseidon([1, 2])

    chai.assert.equal(res.toString(), poseidon.F.toString(res2))
  }).timeout(100000);

  it("should deposit", async () => {
    
  })
})