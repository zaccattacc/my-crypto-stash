import React from 'react'
import { Box, Stack } from '@chakra-ui/react'
import MenuItem from './MenuItem'
import Connect from './Connect'

const MenuLinks = ({ connection, connect, isOpen }) => {
  return (
    <Box
        display={{ base: isOpen ? "block" : "none", md: "block" }}
        flexBasis={{ base: "100%", md: "auto" }}
    >
        <Stack
            spacing={8}
            align="center"
            justify={["center", "space-between", "flex-end", "flex-end"]}
            direction={["column", "row", "row", "row"]}
            pt={[4, 4, 0, 0]}
        >
            <MenuItem to='/'>Home</MenuItem>
            <MenuItem to='/about'>About</MenuItem>
            <Connect connection={connection} connect={connect}></Connect>
        </Stack>
    </Box>
  )
}

export default MenuLinks