import React from 'react'
import { Box, Text } from '@chakra-ui/react'

const Logo = (props) => {
    return (
        <Box {...props}>
          <Text fontSize="lg" fontWeight="bold">
            My Crypto Stash
          </Text>
        </Box>
    )
}

export default Logo