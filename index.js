const inquirer = require('inquirer');
const keys = require('shr-keys');
const {assertIsDeliverTxSuccess, Secp256k1HdWallet, Secp256k1Wallet, ShareledgerSigningClient} = require('shr-client-ts');
const {EnglishMnemonic} = require('@cosmjs/crypto');
const {BigNumber} = require('bignumber.js');

const rpcUrl = 'https://tencent.blockchain.testnet.sharetoken.io:26658';
const explorerUrl = 'https://explorer.testnet.sharetoken.io';

const greeting = () => {
  inquirer
  .prompt([
    {
      type: 'confirm',
      message: 'This tool will check if you have had OLD shareledger address and support with some utilities. Continue?',
      name: 'continue',
    },
  ])
  .then(answers => {
    if (!answers.continue) {
      console.log('Bye!')
      return process.exit(0);
    }
    step1();
  })
}

const step1 = () => {
  inquirer
  .prompt([
    {
      type: 'password',
      mask: '*',
      suffix: "\n",
      message: 'Now enter your 12-word passphrase (mnemonic). It will be masked with \'*\'. Your passphrase stays with you and you only.',
      name: 'mnemonic',
      validate: (input) => {
        try {
          const m = new EnglishMnemonic(input);
          return true;
        }
        catch(err) {
          return 'The entered passphrase is invalid. Please check carefully.';
        }
      }
    }
  ])
  .then(answers => {
    return step2(answers.mnemonic);
  })
}

const step2 = async (mnemonic) => {
  const acc1 = keys.KeyPair.fromMnemonic(mnemonic);
  const w = await Secp256k1HdWallet.fromMnemonic(mnemonic);
  const [acc2] = await w.getAccountsWithPrivkeys();
  inquirer
  .prompt([
    {
      type: 'confirm',
      message: `Is \'${acc1.address}\' your OLD address?`,
      default: false,
      name: 'continue1'
    },
    {
      type: 'confirm',
      message: `Is \'${acc2.address}\' your NEW address?`,
      default: false,
      name: 'continue2'
    }
  ])
  .then(answers => {
    if (!answers.continue1 || !answers.continue2) {
      console.log('You must have used different passphases for your accounts. There\'s not much we can do.')
      return process.exit(0);
    }
    step3(acc1, acc2);
  })
}

const step3 = async (acc1, acc2) => {
  console.log('Connecting to RPC...');

  const client = await ShareledgerSigningClient.connect(rpcUrl);

  console.log('Checking balance...');
  
  let hasBalances = false;
  let hasDelegations = false;
  let hasRewards = false;
  
  const balances = await client.bank.allBalances(acc1.address);
  if (balances.length > 0) {
    hasBalances = true;
    console.log(balances.map(b=>`${b.amount}${b.denom}`).join(', '));
  }

  console.log('Checking delegations...');

  const delegations = await client.staking.delegatorDelegations(acc1.address);
  if (delegations.delegationResponses.length > 0) {
    hasDelegations = true;
    for (const d of delegations.delegationResponses) {
      if (!d.balance) {
        continue;
      }
      console.log(`${d.delegation.validatorAddress}: ${d.balance.amount}${d.balance.denom}`);
    }
  }

  console.log('Checking rewards...');

  const rewards = await client.distribution.delegationTotalRewards(acc1.address);
  if (rewards.rewards.length) {
    hasRewards = true;
    for (const r of rewards.rewards) {
      console.log(`${r.validatorAddress}: ${r.reward.map(rr => `${rr.amount}${rr.denom}`).join(', ')}`);
    }
  }

  const choices = [];
  if (hasBalances) {
    choices.push({
      name: 'Transfer ALL balances from OLD address to NEW address',
      value: 'transfer'
    })
  }
  if (hasDelegations) {
    choices.push({
      name: 'Undelegate ALL delegations from OLD address',
      value: 'undelegate'
    })
  }
  if (hasRewards) {
    choices.push({
      name: 'Claim ALL rewards for OLD address',
      value: 'claim'
    })
  }

  if (!choices.length) {
    console.log('There\'s no actions required. You can start over with your NEW shareledger address');
    process.exit(0);
  }

  inquirer
  .prompt([
    {
      type: 'confirm',
      message: 'Are you sure you have enough SHR to perform transactions?',
      name: 'sure',
    },
    {
      name: 'action',
      message: 'Please select one of the following:',
      type: 'list',
      choices: choices
    }
  ])
  .then(answers => {
    if (!answers.sure) {
      process.exit(0);
    }
    switch (answers.action) {
      case 'transfer':
        return inquirer
        .prompt([
          {
            type: 'confirm',
            message: 'Transferring ALL tokens may get your OLD address to be unable to perform any other transactions. If you have delegations and/or rewards to be claimed, please do it first. Continue?',
            name: 'continue',
          },
        ])
        .then(answers => {
          if (!answers.continue) {
            process.exit(0);
          }
          return transfer(acc1, acc2, balances);
        })
        
      case 'undelegate':
        return inquirer
        .prompt([
          {
            type: 'confirm',
            message: 'Undelegating requires up to 21 days for the tokens to be avail in your balance. Continue?',
            name: 'continue',
          },
        ])
        .then(answers => {
          if (!answers.continue) {
            process.exit(0);
          }
          return undelegate(acc1, acc2, delegations);
        })
      case 'claim':
        return claim(acc1, acc2, rewards);
      default:
        break;
    }
  })
}

const transfer = async (acc1, acc2, balances) => {
  try {
    console.log('Creating transaction...');
    const client = await ShareledgerSigningClient.connect(rpcUrl);
    const signer = await Secp256k1Wallet.fromKey(Buffer.from(acc1.privKey, "hex"));
    await client.withSigner(signer);
    const fee = await client.gentlemint.feeByAction('bank_send');
    const [acc] = await signer.getAccounts();
    balances = balances.map(b => {
      return b.denom === 'nshr' 
      ? {
        denom: 'nshr',
        amount: new BigNumber(b.amount).minus(fee.amount).toString(10)
      } 
      : b;
    });
    const msg = client.bank.send(acc.address, acc2.address, balances);
    console.log('Signing and broadcasting...');
    const res = await client.signAndBroadcast(acc.address, [msg]);
    assertIsDeliverTxSuccess(res);
    console.log(`View transaction hash: ${explorerUrl}/transactions/${res.transactionHash}`);
  }
  catch(err) {
    console.error('An unexpected error has occurred. Please take a screenshot of this screen and send to ShareRing customer support for further investigation.');
    console.log('-------------------------------');
    console.log('-------------------------------');
    console.error(err);
  }
}

const undelegate = async (acc1, acc2, delegations) => {
  try {
    console.log('Creating transaction...');
    const client = await ShareledgerSigningClient.connect(rpcUrl);
    const balance = await client.bank.balance(acc1.address, 'nshr');
    const fee = await client.gentlemint.feeByAction('staking_unbond');
    if (new BigNumber(balance.amount).lt(fee.amount)) {
      throw new Error('You don\'t have enough balance to proceed.');
    }
    const signer = await Secp256k1Wallet.fromKey(Buffer.from(acc1.privKey, "hex"));
    await client.withSigner(signer);
    const [acc] = await signer.getAccounts();
    const msgs = [];
    for (const d of delegations.delegationResponses) {
      if (!d.balance) {
        continue;
      }
      msgs.push(client.staking.undelegate(acc.address, d.delegation.validatorAddress, d.balance));
    }
    console.log('Signing and broadcasting...');
    const res = await client.signAndBroadcast(acc.address, msgs);
    assertIsDeliverTxSuccess(res);
    console.log(`View transaction hash: ${explorerUrl}/transactions/${res.transactionHash}`);
  }
  catch(err) {
    console.error('An unexpected error has occurred. Please take a screenshot of this screen and send to ShareRing customer support for further investigation.');
    console.log('-------------------------------');
    console.log('-------------------------------');
    console.error(err);
  }
}

const claim = async (acc1, acc2, rewards) => {
  try {
    console.log('Creating transaction...');
    const client = await ShareledgerSigningClient.connect(rpcUrl);
    const signer = await Secp256k1Wallet.fromKey(Buffer.from(acc1.privKey, "hex"));
    const balance = await client.bank.balance(acc1.address, 'nshr');
    const fee = await client.gentlemint.feeByAction('distribution_withdraw-delegator-reward');
    if (new BigNumber(balance.amount).lt(fee.amount)) {
      throw new Error('You don\'t have enough balance to proceed.');
    }
    await client.withSigner(signer);
    const [acc] = await signer.getAccounts();
    const msgs = [];
    for (const r of rewards.rewards) {
      msgs.push(client.distribution.withdrawRewards(acc.address, r.validatorAddress));
    }
    console.log('Signing and broadcasting...');
    const res = await client.signAndBroadcast(acc.address, msgs);
    assertIsDeliverTxSuccess(res);
    console.log(`View transaction hash: ${explorerUrl}/transactions/${res.transactionHash}`);
  }
  catch(err) {
    console.error('An unexpected error has occurred. Please take a screenshot of this screen and send to ShareRing customer support for further investigation.');
    console.log('-------------------------------');
    console.log('-------------------------------');
    console.error(err);
  }
}


greeting();