import React, { useState, useRef } from 'react'
import * as ethers from "ethers"
import { 
  Input, 
  InputGroup,
  InputRightElement,
  Button,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Stack,
  Wrap,
  Center,
  useClipboard 
} from '@chakra-ui/react'
import { Contract, providers, utils } from 'ethers'
import ETHMyCryptoStash from "../../artifacts/ETHMyCryptoStash.json"
const { utils: util } = require("ffjavascript")
const { stringifyBigInts } = util
const buildPoseidon = require("circomlibjs").buildPoseidon
const { MerkleTree } = require("fixed-merkle-tree")
const ZERO_VALUE = "21663839004416932945382355908790599225266501822907911457504978515578255421292"

const Deposit = ({ ethersProvider }) => {



  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [elements, setElements] = useState([])
  const { isOpen, onOpen, onClose } = useDisclosure()
  const cancelRef = useRef()
  const { hasCopied, onCopy } = useClipboard(note)



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
    setNote("")
    const provider = new providers.Web3Provider(ethersProvider)
    const contract = new Contract("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", ETHMyCryptoStash.abi, provider)

    await provider.send("eth_requestAccounts", [])


    const contractSigner = contract.connect(provider.getSigner())

    const deposit = await generateDeposit(utils.parseEther(value))

    
    const tx = await contractSigner['deposit'](deposit.commitment, utils.parseEther(value), { value: utils.parseEther(value) })
    console.log(tx)

    
    const poseidon = await buildPoseidon()

    const poseidonHash = (...args) => {
      const hash = poseidon(args)
      const hashStr = poseidon.F.toString(hash)
      return hashStr
    }

    const elements = await contract.getCommitments()

    const tree = new MerkleTree(20, stringifyBigInts(elements), { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })
    console.log(tree.elements)

    tree.insert(deposit.commitment)

    const depositIndex = tree.indexOf(deposit.commitment)

    const { pathElements, pathIndices, pathRoot } = tree.path(depositIndex)

    const nullifier = ethers.BigNumber.from(deposit.nullifier).toBigInt()
    const secret = ethers.BigNumber.from(deposit.secret).toBigInt()
    const proof = {
      nullifier: nullifier.toString(),
      secret: secret.toString(),
      amount: value
    }

    const editedProof = JSON.stringify(proof)
    const encoder = new TextEncoder()
    const encodedProof = encoder.encode(editedProof)
    const note = Buffer.from(encodedProof).toString('hex')
    setNote("0x" + note)
    console.log(proof)

  }

  const handleChange = (event) => setValue(event.target.value)
  const handleSubmit = (event) => {
    event.preventDefault();
    (ethersProvider ? onDeposit() : alert("Connect your wallet."))
  }


  return (
    <div>
        <form onSubmit={handleSubmit}>
            <Stack direction={"column"}>
                <Center>
                  <Wrap spacing='6'>
                      <Button onClick={() => setValue('10')}>10</Button>
                      <Button onClick={() => setValue('100')}>100</Button>
                      <Button onClick={() => setValue('1000')}>1000</Button>
                      <Button onClick={() => setValue('10000')}>10000</Button>
                  </Wrap>
                </Center>
                <Center>
                
                  <Input value={value} onChange={handleChange} placeholder='ETH amount' isReadOnly={true}/>
                </Center>
                <Center>
                  <Button type="submit" onClick={(ethersProvider ? onOpen : undefined)} w="150px">Deposit</Button>
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
                Your note for the deposit of {value} ETH is:
                <InputGroup>
                  <Input value={note} isReadOnly placeholder='Welcome'/>
                  <InputRightElement width='4.5rem'>
                    <Button onClick={onCopy} ml={2}>
                      {hasCopied ? 'Copied' : 'Copy'}
                    </Button>
                  </InputRightElement>
                </InputGroup> 
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