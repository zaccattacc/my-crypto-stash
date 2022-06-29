import React, { useState, useRef, useEffect } from 'react'
import * as ethers from "ethers"
import { Input, Button, useDisclosure, AlertDialog,
    AlertDialogBody,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogContent,
    AlertDialogOverlay,
    Stack,
    Wrap,
    Center, } from '@chakra-ui/react'
import { Contract, providers, utils } from 'ethers'
import ETHMyCryptoStash from "../artifacts/ETHMyCryptoStash.json"
const buildPoseidon = require("circomlibjs").buildPoseidonOpt
const { MerkleTree } = require("fixed-merkle-tree")
const ZERO_VALUE = "21663839004416932945382355908790599225266501822907911457504978515578255421292"

const Deposit = ({ ethersProvider }) => {



    const [value, setValue] = useState('')
    const [note, setNote] = useState('')
    const [elements, setElements] = useState()
    const { isOpen, onOpen, onClose } = useDisclosure()
    const cancelRef = useRef()


    useEffect(() => {
        const getElements = async () => {
            const elementsFromServer = await fetchElements()
            setElements(elementsFromServer)
        }
        getElements()
      }, [])
    
      const fetchElements = async () => {
          const res = await fetch('http://localhost:5000/tree/1/')
          const data = await res.json()
          console.log(data)
          return data
      }
    
    async function generateDeposit(...args){
        const poseidon = await buildPoseidon();
      
        const deposit = {
          secret: utils.randomBytes(31),
          nullifier: utils.randomBytes(31),
        }
      
        let commit
      
        
        commit = poseidon([
        ethers.BigNumber.from(deposit.nullifier).toBigInt(),
        ethers.BigNumber.from(deposit.secret).toBigInt(),
        args[0]
        ])
        

        
        deposit.commitment = poseidon.F.toString(commit)

        console.log(deposit.commitment)
      
        return deposit
      }

      
    

    async function onDeposit(){
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0x09635F643e140090A9A8Dcd712eD6285858ceBef", ETHMyCryptoStash.abi, provider)

        const contractSigner = contract.connect(provider.getSigner())

        const deposit = await generateDeposit(utils.parseEther(value))

        
        const tx = await contractSigner['deposit(uint256, uint256)'](deposit.commitment, utils.parseEther(value), { value: utils.parseEther(value) })
        console.log(tx)

        
        const poseidon = await buildPoseidon()

        const poseidonHash = (...args) => {
            const hash = poseidon(args)
            const hashStr = poseidon.F.toString(hash)
            return hashStr
        }

        const tree = new MerkleTree(20, elements.elements, { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })

        tree.insert(deposit.commitment)

        const treeElements = { elements: tree.elements}

        const updateElements = async () => {
            await fetch('http://localhost:5000/tree/1', {
                method: 'DELETE',
            })

            await fetch('http://localhost:5000/tree', {
                method: 'POST',
                headers: {
                    'Content-type': 'application/json'
                },
                body: JSON.stringify(treeElements)
            })
        }

        await updateElements()
        console.log(tree.elements)

        const depositIndex = tree.indexOf(deposit.commitment)

        const { pathElements, pathIndices, pathRoot } = tree.path(depositIndex)

        const nullifier = ethers.BigNumber.from(deposit.nullifier).toBigInt()
        const secret = ethers.BigNumber.from(deposit.secret).toBigInt()
        const proof = {
            nullifier: nullifier.toString(),
            secret: secret.toString(),
            root: pathRoot,
            pathIndices: pathIndices,
            pathElements: pathElements,
            amount: value
        }

        const editedProof = JSON.stringify(proof)
        const encoder = new TextEncoder()
        const encodedProof = encoder.encode(editedProof)
        const note = Buffer.from(encodedProof).toString('hex')
        setNote("0x" + note)
        console.log("0x" + note)

    }

    const handleChange = (event) => setValue(event.target.value)
    const handleSubmit = (event) => {
        event.preventDefault();
        onDeposit()
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
                <Input value={value} onChange={handleChange} placeholder='ETH amount' isReadOnly={true} w="350px"/>
                </Center>
                <Center>
                <Button type="submit" onClick={onOpen} w="150px">Deposit</Button>
                </Center>
                
            </Stack>
        </form>
        <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize='lg' fontWeight='bold'>
                Deposit
            </AlertDialogHeader>

            <AlertDialogBody>
                Your note for the deposit of {value} ETH is {note}
            </AlertDialogBody>

            <AlertDialogFooter>
              
              <Button colorScheme='red' onClick={onClose} ml={3}>
                Close
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </div>
    
  )
}

export default Deposit