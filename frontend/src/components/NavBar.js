
import React from 'react'
import { useState } from 'react'
import Logo from './Logo'
import MenuLinks from './MenuLinks'
import MenuToggle from './MenuToggle'
import NavbarContainer from './NavbarContainer'

const NavBar = (props) => {
    const { connection, connect } = props

    const [isOpen, setIsOpen] = useState(false)

    const toggle = () => setIsOpen(!isOpen)

  return (
    <NavbarContainer {...props}>
        <Logo
            w="150px"
            color={["black", "black", "primary.500", "primary.500"]}
        />
        <MenuToggle toggle={toggle} isOpen={isOpen} />
        <MenuLinks connection={connection} connect={connect} isOpen={isOpen} />
    </NavbarContainer>
  )
}

export default NavBar