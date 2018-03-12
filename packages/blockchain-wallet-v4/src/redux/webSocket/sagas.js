import { takeEvery, call, put, select } from 'redux-saga/effects'
import { compose } from 'ramda'
import * as A from '../actions'
import * as AT from './actionTypes'
import { Wrapper } from '../../types'
import * as walletSelectors from '../wallet/selectors'
import { Socket } from '../../network'
import * as btcActions from '../data/bitcoin/actions'

export const webSocketSaga = ({ api, socket } = {}) => {
  const send = socket.send.bind(socket)

  const onOpen = function * (action) {
    const subscribeInfo = yield select(walletSelectors.getInitialSocketContext)
    yield call(compose(send, Socket.onOpenMessage), subscribeInfo)
  }

  const onMessage = function * (action) {
    const message = action.payload

    switch (message.op) {
      case 'on_change':
        const newChecksum = message.x.checksum
        const wrapper = yield select(walletSelectors.getWrapper)
        const oldChecksum = Wrapper.selectPayloadChecksum(wrapper)
        if (oldChecksum !== newChecksum) {
          yield call(refreshWrapper)
          const walletContext = yield select(walletSelectors.getWalletContext)
          yield put(btcActions.fetchData(walletContext))
        }
        break
      case 'utx':
        const walletContext = yield select(walletSelectors.getWalletContext)
        yield put(btcActions.fetchData(walletContext))
        yield put(btcActions.fetchTransactions('', true))
        break
      case 'block':
        const newBlock = message.x
        yield put(A.data.bitcoin.setBitcoinLatestBlock(newBlock.blockIndex, newBlock.hash, newBlock.height, newBlock.time))
        yield put(btcActions.fetchTransactions('', true))
        break
      case 'pong':
        console.log('pong ', message)
        // Do nothing
        break
      case 'email_verified':
        console.log('email_verified ', message)
        //   MyWallet.wallet.accountInfo.isEmailVerified = Boolean(obj.x);
        //   WalletStore.sendEvent('on_email_verified', obj.x);
        break
      case 'wallet_logout':
        // WalletStore.sendEvent('wallet_logout', obj.x);
        break

      default:
        console.log('unknows type for ', message)
        break
    }
  }

  const onClose = function * (action) {
  }

  const refreshWrapper = function * () {
    const guid = yield select(walletSelectors.getGuid)
    const skey = yield select(walletSelectors.getSharedKey)
    const password = yield select(walletSelectors.getMainPassword)
    try {
      const newWrapper = yield call(api.fetchWallet, guid, skey, undefined, password)
      yield put(A.wallet.refreshWrapper(newWrapper))
    } catch (e) {
      console.log('REFRESH WRAPPER FAILED (WEBSOCKET) :: should dispatch error action ?')
    }
  }

  return function * () {
    yield takeEvery(AT.OPEN_SOCKET, onOpen)
    yield takeEvery(AT.MESSAGE_SOCKET, onMessage)
    yield takeEvery(AT.CLOSE_SOCKET, onClose)
  }
}
