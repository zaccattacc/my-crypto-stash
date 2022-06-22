import utils from "@aztec/dev-utils";
const bn128 = require('@aztec/bn128');
const {
    proofs: {
      JOIN_SPLIT_PROOF,
      MINT_PROOF
    },
  } = utils;
const chai = require("chai")
const { ethers } = require("hardhat")

const aztec = require("aztec.js");
const dotenv = require("dotenv");
dotenv.config();
const secp256k1 = require("@aztec/secp256k1");

describe("Shielding test", () => {
    let ace;
    let zkETH;
    let sheild;

    before(async () => {
        const ACE = await ethers.getContractFactory("ACE", signer)
        ace = await ACE.deploy()
        const JoinSplitFluid = await ethers.getContractFactory("JoinSplitFluid")
        const joinSplitFluid = await JoinSplitFluid.deploy()
        const JoinSplit = await ethers.getContractFactory("JoinSplit")
        const joinSplit = await JoinSplit.deploy()
        await ace.setCommonReferenceString(bn128.CRS)
        await ace.setProof(MINT_PROOF, joinSplitFluid.address)
        await ace.setProof(JOIN_SPLIT_PROOF, joinSplit.address)
    })

    beforeEach(async () => {
        const [signer] = await ethers.getSigners()
        
        const ZKETH = await ethers.getContractFactory("ZkETH")
        zkETH = await ZKETH.deploy(ace.address, "0x0", )
    })
})