import React from 'react'

const Connect = ({ connection, connect }) => {
  return (
    <div onClick={() => connect()}>{connection}</div>
  )
}

export default Connect