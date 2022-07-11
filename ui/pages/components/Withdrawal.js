import React, { useState, useRef, useEffect } from 'react'
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
    Switch,
    FormControl,
    FormErrorMessage,
    FormLabel,
    Spinner,
    useClipboard
} from '@chakra-ui/react'
import { FaCheckCircle } from "react-icons/fa"
import { Contract, providers, utils, Wallet } from 'ethers'
import ETHMyCryptoStash from "../../artifacts/ETHMyCryptoStash.json"

const { groth16 } = require("snarkjs")
const buildPoseidon = require("circomlibjs").buildPoseidonOpt
const { MerkleTree } = require("fixed-merkle-tree")
const { utils: util } = require("ffjavascript")
const { stringifyBigInts, unstringifyBigInts } = util


const ZERO_VALUE = "21663839004416932945382355908790599225266501822907911457504978515578255421292"


const Withdrawal = ({ethersProvider}) => {
    const [value, setValue] = useState('')
    const [note, setNote] = useState('')
    const [recipient, setRecipient] = useState('')
    const [isPartial, setIsPartial] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const { isOpen, onOpen, onClose } = useDisclosure()
    const { hasCopied, onCopy } = useClipboard(note)


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
        if(!isPartial){
            
            (ethersProvider ? onWithdrawal() : alert("Connect your wallet."))
        }
        else{
            (ethersProvider ? onPartialWithdrawal() : alert("Connect your wallet."))
        }   
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

    async function exportCallDataGroth16(input, wasmFile, zkeyFile){
        const { proof, publicSignals } = await groth16.fullProve(input, wasmFile, zkeyFile)
        const calldata = await groth16.exportSolidityCallData(proof, publicSignals)

        const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());
        const _proof = {
            a: [argv[0], argv[1]],
            b: [[argv[2], argv[3]], [argv[4], argv[5]]],
            c: [argv[6], argv[7]],
        }
        return _proof
    }

    async function onWithdrawal(){
        const provider = new providers.Web3Provider(ethersProvider)
        const relayer = new Wallet(process.env.NEXT_PUBLIC_RELAYER, provider)
        const contract = new Contract("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", ETHMyCryptoStash.abi, provider)

        console.log(contract)



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

        const elements = await contract.getCommitments()

        const tree = new MerkleTree(20, stringifyBigInts(elements), { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })
        console.log(tree.elements)

        const depositIndex = tree.indexOf(poseidonHash(proofUser.nullifier, proofUser.secret, utils.parseEther(proofUser.amount)))

        const { pathElements, pathIndices, pathRoot } = tree.path(depositIndex)

        
        const nullifierHash = poseidonHash(proofUser.nullifier, 1, depositIndex)

        const fee = parseInt(proofUser.amount) * 0.03/100

        // Generates the proof for the withdrawal
        const input = stringifyBigInts({
            // Public inputs
            "root": pathRoot,
            nullifierHash,
            recipient,
            "relayer": relayer.address,
            "fee": utils.parseEther(fee.toString()),
            "withdrawAmount": utils.parseEther(proofUser.amount),
            // Private inputs
            "amount": utils.parseEther(proofUser.amount),
            "nullifier": proofUser.nullifier,
            "secret": proofUser.secret,
            "pathElements": pathElements, 
            "pathIndices": pathIndices,
        })

        const solCalldata = await exportCallDataGroth16(input, "zkProof/withdraw.wasm", "zkProof/circuit_final.zkey")

        
        
        await contract.connect(relayer).withdraw(solCalldata, pathRoot, nullifierHash, recipient, relayer.address, utils.parseEther(fee.toString()), utils.parseEther(proofUser.amount)).then(
            (value) => {
                setIsSuccess(true)
                setNote('')
            }, (reason) => {
                console.log(reason)
                alert("Transaction failed. Try again.")
            }
        )
        
    }

    const onPartialWithdrawal = async () => {
        setIsSuccess(false)
        const provider = new providers.Web3Provider(ethersProvider)
        const relayer = new Wallet(process.env.NEXT_PUBLIC_RELAYER, provider)
        const contract = new Contract("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", ETHMyCryptoStash.abi, relayer)

        console.log(contract)
        
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

        const elements = await contract.getCommitments()

        const tree = new MerkleTree(20, stringifyBigInts(elements), { hashFunction: poseidonHash, zeroElement: ZERO_VALUE })
        console.log(tree.elements)

        const depositIndex = tree.indexOf(poseidonHash(proofUser.nullifier, proofUser.secret, utils.parseEther(proofUser.amount)))

        const { pathElements, pathIndices, pathRoot } = tree.path(depositIndex)

        console.log(pathRoot, stringifyBigInts(await contract.roots(depositIndex + 1)), proofUser)

        const nullifierHash = poseidonHash(proofUser.nullifier, 1, depositIndex)

        const fee = parseInt(value) * 0.03/100

        const withdrawAmount = utils.parseEther(value)

        // Generates the proof for the withdrawal
        const input = stringifyBigInts({
            // Public inputs
            "root": pathRoot,
            nullifierHash,
            recipient,
            "relayer": relayer.address,
            "fee": utils.parseEther(fee.toString()),
            withdrawAmount,
            // Private inputs
            "amount": utils.parseEther(proofUser.amount),
            "nullifier": proofUser.nullifier,
            "secret": proofUser.secret,
            "pathElements": pathElements, 
            "pathIndices": pathIndices,
        })

        const solCalldata = await exportCallDataGroth16(input, "zkProof/withdraw.wasm", "zkProof/circuit_final.zkey")

        const remainder = parseInt(utils.parseEther(proofUser.amount)) - parseInt(utils.parseEther(value))

        const deposit = await generateDeposit(remainder.toString())

        tree.insert(deposit.commitment)
        
        await contract.partialWithdraw(solCalldata, pathRoot, nullifierHash, recipient, relayer.address, utils.parseEther(fee.toString()), utils.parseEther(value), deposit.commitment).then(
            (value) => {
                setIsSuccess(true)
            }, (reason) => {
                console.log(reason)
                alert("Transaction failed.")
            }
        )


        const nullifier = ethers.BigNumber.from(deposit.nullifier).toBigInt()
        const secret = ethers.BigNumber.from(deposit.secret).toBigInt()
        const proof = {
            nullifier: nullifier.toString(),
            secret: secret.toString(),
            amount: ethers.utils.formatEther(remainder.toString())
        }

        const editedProof1 = JSON.stringify(proof)
        const encoder = new TextEncoder()
        const encodedProof1 = encoder.encode(editedProof1)
        const note1 = Buffer.from(encodedProof1).toString('hex')
        setNote("0x" + note1)
         
    }

  return (
    <div>
        

        <form onSubmit={handleSubmit}>
            <Stack direction={"column"}>
                {   isPartial &&
                    <Center>
                        <Wrap spacing='3'>
                            <Button onClick={() => setValue('10')}>10</Button>
                            <Button onClick={() => setValue('50')}>50</Button>
                            <Button onClick={() => setValue('100')}>100</Button>
                            <Button onClick={() => setValue('500')}>500</Button>
                            <Button onClick={() => setValue('1000')}>1000</Button>
                            <Button onClick={() => setValue('5000')}>5000</Button>
                            <Button onClick={() => setValue('10000')}>10000</Button>
                        </Wrap>
                    </Center>
                }
                <Center>
                    <FormControl isInvalid=''>
                        <Input onChange={handleChange} placeholder='Note'/>
                        <FormErrorMessage>Email is required.</FormErrorMessage>
                    </FormControl>
                </Center>
                {isPartial &&
                <Center>
                    <Input value={value} onChange={handleChange2} placeholder='ETH amount'/>
                </Center>}
                <Center>
                    <Input  onChange={handleChange3} placeholder='Recipient'/>
                </Center>
                <FormControl display='flex' alignItems='center'>
                    <FormLabel htmlFor='email-alerts' mb='0'>
                        Partial Withdraw
                    </FormLabel>
                    <Switch id='email-alerts' onChange={() => setIsPartial(!isPartial)}/>
                </FormControl>
                <Center>
                    <Button type="submit" onClick={(ethersProvider ? onOpen : undefined)} w="150px">Withdrawal</Button>
                </Center>
                
            </Stack>
            <AlertDialog
                isOpen={isOpen}
                onClose={onClose}
                >
                <AlertDialogOverlay>
                <AlertDialogContent>
                    <AlertDialogHeader fontSize='lg' fontWeight='bold'>
                        Withdrawal
                    </AlertDialogHeader>

                    <AlertDialogBody>
                        {isSuccess ? <>Done <FaCheckCircle /> </> : <Spinner />}
                        { isPartial &&
                        <InputGroup>
                            <Input value={note} isReadOnly placeholder='Note'/>
                            <InputRightElement width='4.5rem'>
                                <Button onClick={onCopy} ml={2}>
                                {hasCopied ? 'Copied' : 'Copy'}
                                </Button>
                            </InputRightElement>
                        </InputGroup> }
                    </AlertDialogBody>

                    <AlertDialogFooter>
                    
                    <Button colorScheme='red' onClick={onClose} ml={3}>
                        Close
                    </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>
        </form>
    </div>
  )
}

export default Withdrawal