#!/bin/bash

cd circuits

mkdir withdraw

if [ -f ./powersOfTau28_hez_final_16.ptau ]; then
    echo "powersOfTau28_hez_final_16.ptau already exists. Skipping."
else
    echo 'Downloading powersOfTau28_hez_final_16.ptau'
    wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau
fi

echo "Compiling withdraw.circom"

#compile Circuit

circom withdraw.circom --r1cs --wasm --sym -o withdraw
snarkjs r1cs info withdraw/withdraw.r1cs

# Start a new zkey and make a contribution

snarkjs groth16 setup withdraw/withdraw.r1cs powersOfTau28_hez_final_16.ptau withdraw/circuit_0000.zkey
snarkjs zkey contribute withdraw/circuit_0000.zkey withdraw/circuit_final.zkey --name="Ist Contributor Name" -v -e="random text"
snarkjs zkey export verificationkey withdraw/circuit_final.zkey withdraw/verification_key.json

# generate solidity contract

snarkjs zkey export solidityverifier withdraw/circuit_final.zkey ../contracts/Verifier.sol

cd ..