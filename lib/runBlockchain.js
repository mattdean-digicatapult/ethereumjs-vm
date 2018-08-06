const async = require('async')

/**
 * processes blocks and adds them to the blockchain
 * @method onBlock
 * @param blockchain
 */
module.exports = function (blockchain, cb) {
  var self = this
  var headBlock

  // parse arguments
  if (typeof blockchain === 'function') {
    cb = blockchain
    blockchain = undefined
  }

  blockchain = blockchain || self.blockchain

  // setup blockchain iterator
  blockchain.iterator('vm', processBlock, cb)
  function processBlock (block, reorg, cb) {
    async.series([
      getStartingState,
      runBlock
    ], cb)

    // determine starting state for block run
    function getStartingState (cb) {
      // if we are just starting or if a chain re-org has happened
      if (!headBlock || reorg) {
        blockchain.getBlock(block.header.parentHash, function (err, parentBlock) {
          if (err) return cb(err)

          self.stateManager.getStateRoot(function (err, stateManagerRoot) {
            if (err) return cb(err)

            var parentState = parentBlock.header.stateRoot
            // generate genesis state if we are at the genesis block
            // we don't have the genesis state
            if (!headBlock && parentState.toString('hex') !== stateManagerRoot.toString('hex')) {
              return self.stateManager.generateCanonicalGenesis(cb)
            } else {
              cb(err)
            }
          })
        })
      } else {
        cb()
      }
    }

    // run block, update head if valid
    function runBlock (cb) {
      self.runBlock({
        block: block
      }, function (err, results) {
        if (err) {
          // remove invalid block
          console.log('Invalid block error:', err)
          blockchain.delBlock(block.header.hash(), cb)
        } else {
          // set as new head block
          headBlock = block
          cb()
        }
      })
    }
  }
}
