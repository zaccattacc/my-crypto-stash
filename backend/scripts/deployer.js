const { poseidonContract, buildPoseidon } = require("circomlibjs")
const { ethers } = require("hardhat")
const { ContractFactory } = require("ethers")


function getPoseidonFactory(nInputs){
    const bytecode = poseidonContract.createCode(nInputs)
    const abiJson = poseidonContract.generateABI(nInputs)
    const abi = new ethers.utils.Interface(abiJson)
    return new ContractFactory(abi, bytecode)
  }
  

async function main() {
    // We get the contract to deploy
    const [signer] = await ethers.getSigners()
    const Verifier = await ethers.getContractFactory("PlonkVerifier")
    const verifier = await Verifier.deploy()
    await verifier.deployed()
    const poseidon = await getPoseidonFactory(2).connect(signer).deploy()
    console.log(poseidon)
    // await poseidon.deployed()
    const MyCryptoStash = await ethers.getContractFactory("ETHMyCryptoStash")
    const myCryptoStash = await MyCryptoStash.deploy(poseidon.address, "100000000000000000", 20, verifier.address)
    await myCryptoStash.deployed()
  
    console.log("My Crypto stash deployed to:", myCryptoStash.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });