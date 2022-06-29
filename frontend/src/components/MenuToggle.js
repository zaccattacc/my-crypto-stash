import React from 'react'
import { Box } from "@chakra-ui/react"
import { VscChromeClose, VscMenu } from "react-icons/vsc"

const MenuToggle = ({ toggle, isOpen }) => {
  return (
    <Box display={{ base: "block", md: "none" }} onClick={toggle}>
        {isOpen ? <VscChromeClose /> : <VscMenu />}
    </Box>
  )
}

export default MenuToggle