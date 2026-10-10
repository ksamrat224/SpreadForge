#[cfg(test)]
mod paper_tests {
    use anchor_lang::{system_program, AccountDeserialize, InstructionData};
    use litesvm::LiteSVM;
    use solana_sdk::{
        clock::Clock,
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        transaction::Transaction,
    };

    use crate::{
        constants::{PAPER_FIXED_USDC_CENTS, PAPER_SEED, PAPER_SOL_INDEX},
        instructions::{OpenPaperAccountArgs, PaperTradeArgs},
        state::PaperAccount,
        ID as PROGRAM_ID,
    };

    const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
    const NOW: i64 = 1_800_000_000;
    const NOW_MS: i64 = NOW * 1000;

    fn svm() -> LiteSVM {
        let mut svm = LiteSVM::new();
        svm.add_program(
            PROGRAM_ID,
            include_bytes!("../../../target/deploy/result_registry.so"),
        )
        .expect("program loads into LiteSVM");
        let mut clock: Clock = svm.get_sysvar();
        clock.unix_timestamp = NOW;
        svm.set_sysvar(&clock);
        svm
    }

    fn paper_pda(authority: &Pubkey, nonce: u64) -> Pubkey {
        Pubkey::find_program_address(
            &[PAPER_SEED, authority.as_ref(), &nonce.to_le_bytes()],
            &PROGRAM_ID,
        )
        .0
    }

    fn open_ix(authority: &Pubkey, nonce: u64, funding_source: u8) -> Instruction {
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(*authority, true),
                AccountMeta::new(paper_pda(authority, nonce), false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data: crate::instruction::OpenPaperAccount {
                args: OpenPaperAccountArgs {
                    nonce,
                    funding_source,
                    sol_price_cents: 15_000,
                    price_at_ms: NOW_MS,
                },
            }
            .data(),
        }
    }

    fn trade_ix(
        authority: &Pubkey,
        paper: &Pubkey,
        side: u8,
        price_cents: u64,
        size_milli: u64,
        price_at_ms: i64,
    ) -> Instruction {
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new_readonly(*authority, true),
                AccountMeta::new(*paper, false),
            ],
            data: crate::instruction::PaperTrade {
                args: PaperTradeArgs {
                    asset: PAPER_SOL_INDEX as u8,
                    side,
                    source: PaperAccount::MARKET,
                    price_cents,
                    size_milli,
                    price_at_ms,
                },
            }
            .data(),
        }
    }

    fn send(svm: &mut LiteSVM, payer: &Keypair, instruction: Instruction) -> bool {
        // Each trade differs only by data, so expire the blockhash between sends.
        svm.expire_blockhash();
        let tx = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&payer.pubkey()),
            &[payer],
            svm.latest_blockhash(),
        );
        svm.send_transaction(tx).is_ok()
    }

    fn read(svm: &LiteSVM, paper: &Pubkey) -> PaperAccount {
        let account = svm.get_account(paper).expect("paper account exists");
        assert_eq!(account.owner, PROGRAM_ID);
        assert_eq!(account.data.len(), PaperAccount::SPACE);
        PaperAccount::try_deserialize(&mut account.data.as_slice()).unwrap()
    }

    fn funded(svm: &mut LiteSVM, lamports: u64) -> Keypair {
        let wallet = Keypair::new();
        svm.airdrop(&wallet.pubkey(), lamports).unwrap();
        wallet
    }

    #[test]
    fn opens_a_fixed_paper_account_with_simulated_usdc() {
        let mut svm = svm();
        let wallet = funded(&mut svm, LAMPORTS_PER_SOL);
        assert!(send(&mut svm, &wallet, open_ix(&wallet.pubkey(), 0, 0)));

        let paper = read(&svm, &paper_pda(&wallet.pubkey(), 0));
        assert_eq!(paper.authority, wallet.pubkey());
        assert_eq!(paper.usdc_cents, PAPER_FIXED_USDC_CENTS);
        assert_eq!(paper.start_equity_cents, PAPER_FIXED_USDC_CENTS);
        assert_eq!(paper.trade_count, 0);
    }

    #[test]
    fn mirrors_wallet_sol_on_chain_capped_at_ten_sol() {
        let mut svm = svm();
        let wallet = funded(&mut svm, 25 * LAMPORTS_PER_SOL);
        assert!(send(&mut svm, &wallet, open_ix(&wallet.pubkey(), 3, 1)));

        let paper = read(&svm, &paper_pda(&wallet.pubkey(), 3));
        assert_eq!(paper.funding_source, PaperAccount::WALLET_FUNDING);
        assert_eq!(paper.usdc_cents, 0);
        assert_eq!(paper.positions[PAPER_SOL_INDEX].quantity_milli, 10_000);
        // 10 SOL at $150.00.
        assert_eq!(paper.start_equity_cents, 150_000);
        // Only rent and the fee left the wallet; the SOL itself never moved.
        assert!(svm.get_balance(&wallet.pubkey()).unwrap() > 24 * LAMPORTS_PER_SOL);
    }

    #[test]
    fn rounds_costs_up_and_proceeds_down_so_no_order_is_free() {
        let mut svm = svm();
        let wallet = funded(&mut svm, LAMPORTS_PER_SOL);
        let paper = paper_pda(&wallet.pubkey(), 0);
        assert!(send(&mut svm, &wallet, open_ix(&wallet.pubkey(), 0, 0)));

        // 0.062 units at 8 cents is 0.496 cents: the buyer pays a full cent.
        assert!(send(
            &mut svm,
            &wallet,
            trade_ix(&wallet.pubkey(), &paper, 0, 8, 62, NOW_MS)
        ));
        let after_buy = read(&svm, &paper);
        assert_eq!(after_buy.usdc_cents, PAPER_FIXED_USDC_CENTS - 1);
        assert_eq!(after_buy.positions[PAPER_SOL_INDEX].quantity_milli, 62);

        // Selling it back receives nothing, and the lost cent is realized.
        assert!(send(
            &mut svm,
            &wallet,
            trade_ix(&wallet.pubkey(), &paper, 1, 8, 62, NOW_MS)
        ));
        let after_sell = read(&svm, &paper);
        assert_eq!(after_sell.usdc_cents, PAPER_FIXED_USDC_CENTS - 1);
        assert_eq!(after_sell.positions[PAPER_SOL_INDEX].quantity_milli, 0);
        assert_eq!(
            after_sell.positions[PAPER_SOL_INDEX].inventory_cost_cents,
            0
        );
        assert_eq!(after_sell.realized_pnl_cents, -1);
        assert_eq!(after_sell.trade_count, 2);
        assert_eq!(after_sell.recent_fills[1].side, PaperAccount::SELL);
        assert_ne!(after_sell.trade_log_hash, after_buy.trade_log_hash);
    }

    #[test]
    fn rejects_stale_prices_overspending_and_other_signers() {
        let mut svm = svm();
        let wallet = funded(&mut svm, LAMPORTS_PER_SOL);
        let attacker = funded(&mut svm, LAMPORTS_PER_SOL);
        let paper = paper_pda(&wallet.pubkey(), 0);
        assert!(send(&mut svm, &wallet, open_ix(&wallet.pubkey(), 0, 0)));

        // A replayed price from an hour ago.
        assert!(!send(
            &mut svm,
            &wallet,
            trade_ix(
                &wallet.pubkey(),
                &paper,
                0,
                15_000,
                1_000,
                NOW_MS - 3_600_000
            ),
        ));
        // More than the 10,000 USDC balance.
        assert!(!send(
            &mut svm,
            &wallet,
            trade_ix(&wallet.pubkey(), &paper, 0, 15_000, 1_000_000, NOW_MS),
        ));
        // Selling inventory the account does not hold.
        assert!(!send(
            &mut svm,
            &wallet,
            trade_ix(&wallet.pubkey(), &paper, 1, 15_000, 1, NOW_MS),
        ));
        // Someone else's wallet.
        assert!(!send(
            &mut svm,
            &attacker,
            trade_ix(&attacker.pubkey(), &paper, 0, 15_000, 1_000, NOW_MS),
        ));
        assert_eq!(read(&svm, &paper).trade_count, 0);
    }
}
