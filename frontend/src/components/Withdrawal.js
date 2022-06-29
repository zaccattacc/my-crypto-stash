import React, { useState, useRef, useEffect } from 'react'

import { Input, Button, useDisclosure,
    // AlertDialog,
    // AlertDialogBody,
    // AlertDialogFooter,
    // AlertDialogHeader,
    // AlertDialogContent,
    // AlertDialogOverlay,
    Stack,
    Wrap,
    Center, } from '@chakra-ui/react'
import { Contract, providers, utils } from 'ethers'
import ETHMyCryptoStash from "../artifacts/ETHMyCryptoStash.json"
const buildPoseidon = require("circomlibjs").buildPoseidonOpt
const { MerkleTree } = require("fixed-merkle-tree")
const { util } = require("ffjavascript")
const { stringifyBigInts, unstringifyBigInts } = util

const ZERO_VALUE = "21663839004416932945382355908790599225266501822907911457504978515578255421292"
const OWNER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

const Withdrawal = ({ethersProvider}) => {
    const [value, setValue] = useState('')
    const [note, setNote] = useState('')
    const [elements, setElements] = useState()
    const [recipient, setRecipient] = useState('')
    const { isOpen, onOpen, onClose } = useDisclosure()

    useEffect(() => {
        const getElements = async () => {
            const elementsFromServer = await fetchElements()
            setElements(elementsFromServer)
        }
        getElements() 
      }, [])

      const relayer = 0
      
    
      const fetchElements = async () => {
          const res = await fetch('http://localhost:5000/tree/1/')
          const data = await res.json()
          console.log(data)
          return data
      }
    

    const handleChange = (event) => {
        setNote(event.target.value)
    }
    const handleChange2 = (event) => {
        setValue(event.target.value)
    }
    const handleChange3 = (event) => {
        setRecipient(event.target.value)
    }
    const handleSubmit = (event) => {
        event.preventDefault();
        onWithdrawal()
    }

    async function onWithdrawal(){
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", ETHMyCryptoStash.abi, provider)
        const contractOwner = contract.connect(provider.getSigner())



        const noteHex = note.slice(2)
        const encodedProof = Uint8Array.from(Buffer.from(noteHex, 'hex'));
        const decoder = new TextDecoder()
        const editedProof = decoder.decode(encodedProof)
        const proofUser = JSON.parse(editedProof)

        const poseidon = await buildPoseidon()

        const poseidonHash = (...args) => {
            const hash = poseidon(args)
            const hashStr = poseidon.F.toString(hash)
            return hashStr
        }

        const tree = new MerkleTree(20, elements.elements, { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })

        const depositIndex = tree.indexOf(poseidonHash(proofUser.nullifier, proofUser.secret, proofUser.amount))

        const nullifierHash = poseidonHash(proofUser.nullifier, 1, depositIndex)

        // Generates the proof for the withdrawal
        const input = stringifyBigInts({
            // Public inputs
            "root": proofUser.root,
            nullifierHash,
            recipient,
            relayer,
            fee: value * (0.03/100),
            "withdrawAmount": utils.parseEther(value),
            // Private inputs
            "amount": value,
            "nullifier": proofUser.nullifier,
            "secret": proofUser.secret,
            "pathElements": proofUser.pathElements,
            "pathIndices": proofUser.pathIndices,
        })
        
        

        
    }

  return (
    <div>
        <form onSubmit={handleSubmit}>
            <Stack direction={"column"}>
                <Center>
                <Wrap spacing='6'>
                    <Button onClick={() => setValue('0.1')}>0.1</Button>
                    <Button onClick={() => setValue('0.5')}>0.5</Button>
                    <Button onClick={() => setValue('1')}>1</Button>
                    <Button onClick={() => setValue('5')}>5</Button>
                    <Button onClick={() => setValue('10')}>10</Button>
                </Wrap>
                </Center>
                <Center>
                <Input onChange={handleChange} placeholder='Note' w="350px"/>
                </Center>
                <Center>
                <Input value={value} onChange={handleChange2} placeholder='ETH amount' w="350px"/>
                </Center>
                <Center>
                <Input  onChange={handleChange3} placeholder='Recipient' w="350px"/>
                </Center>
                <Center>
                <Button type="submit" onClick={onOpen} w="150px">Withdrawal</Button>
                </Center>
                
            </Stack>
        </form>
    </div>
  )
}

export default Withdrawal