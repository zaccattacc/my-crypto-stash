import NavBar from './components/NavBar';
import React, { useState, useEffect } from 'react';
import { providers } from "ethers"
import detectEthereumProvider from "@metamask/detect-provider";
import Deposit from './components/Deposit';
import { Box, Center, Tabs, TabList, Tab, TabPanel, TabPanels } from "@chakra-ui/react"
import Withdrawal from './components/Withdrawal';
import Script from 'next/script';


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
      <Script id="snarkjs" src="/snarkjs.min.js" />
      <NavBar connection={connection} connect={() => connect()} />
      <Center>
      <Box w="50%">

        <Tabs variant='enclosed'>
          <TabList>
            <Tab>Deposit</Tab>
            <Tab>Withdraw</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Deposit ethersProvider={ethersProvider}/>
            </TabPanel>
            <TabPanel>
              <Withdrawal ethersProvider={ethersProvider}/>
            </TabPanel>
          </TabPanels>
        </Tabs>
        
      </Box>
      </Center>
    </div>
  );
}

export default App;
