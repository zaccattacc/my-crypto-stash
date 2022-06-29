import NavBar from './components/NavBar';
import React, { useState, useEffect } from 'react';
import { providers } from "ethers"
import detectEthereumProvider from "@metamask/detect-provider";
import Deposit from './components/Deposit';
import { Box, Center } from "@chakra-ui/react"
import Withdrawal from './components/Withdrawal';



function App() {

  const [connection, setConnection] = useState("Connect")
  const [ethersProvider, setEthersProvider] = useState()
  


  async function connect(){
    const provider = await detectEthereumProvider()


    if(!provider){
      console.log("Install MetaMask")
    }
    else{
      setConnection("Connected")
    }
    await provider.request({ method: "eth_requestAccounts" })
    setEthersProvider(provider)
  }

  

  return (
    <div>
      <NavBar connection={connection} connect={() => connect()} />
      <Center>
      <Box w="75%">
        <Deposit ethersProvider={ethersProvider}/>
      </Box>
      <Box w="75%">
        <Withdrawal ethersProvider={ethersProvider}/>
      </Box>
      </Center>
    </div>
  );
}

export default App;
