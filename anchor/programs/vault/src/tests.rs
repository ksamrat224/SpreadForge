#[cfg(test)]
mod tests {
    use crate::{constants::RESULT_SEED, ID as PROGRAM_ID};
    use anchor_lang::system_program;
    use litesvm::LiteSVM;
    use solana_sdk::{
        hash::hash,
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        transaction::Transaction,
    };

    const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

    #[derive(Clone)]
    struct SubmitArgs {
        scenario_hash: [u8; 32],
        strategy_hash: [u8; 32],
        result_hash: [u8; 32],
        total_score: u16,
        pnl_bps: i32,
        max_drawdown_bps: u16,
        fills: u16,
        schema_version: u8,
        run_nonce: u64,
    }

    fn standard_args() -> SubmitArgs {
        SubmitArgs {
            scenario_hash: [1; 32],
            strategy_hash: [2; 32],
            result_hash: [3; 32],
            total_score: 8_420,
            pnl_bps: 125,
            max_drawdown_bps: 80,
            fills: 12,
            schema_version: 1,
            run_nonce: 7,
        }
    }

    fn result_pda(authority: &Pubkey, args: &SubmitArgs) -> Pubkey {
        Pubkey::find_program_address(
            &[
                RESULT_SEED,
                authority.as_ref(),
                args.scenario_hash.as_ref(),
                &args.run_nonce.to_le_bytes(),
            ],
            &PROGRAM_ID,
        )
        .0
    }

    fn submit_ix(authority: &Pubkey, result: &Pubkey, args: &SubmitArgs) -> Instruction {
        let digest = hash(b"global:submit_result").to_bytes();
        let mut data = digest[..8].to_vec();
        data.extend_from_slice(&args.scenario_hash);
        data.extend_from_slice(&args.strategy_hash);
        data.extend_from_slice(&args.result_hash);
        data.extend_from_slice(&args.total_score.to_le_bytes());
        data.extend_from_slice(&args.pnl_bps.to_le_bytes());
        data.extend_from_slice(&args.max_drawdown_bps.to_le_bytes());
        data.extend_from_slice(&args.fills.to_le_bytes());
        data.push(args.schema_version);
        data.extend_from_slice(&args.run_nonce.to_le_bytes());

        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(*authority, true),
                AccountMeta::new(*result, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data,
        }
    }

    fn signed_tx(payer: &Keypair, instruction: Instruction, svm: &LiteSVM) -> Transaction {
        Transaction::new_signed_with_payer(
            &[instruction],
            Some(&payer.pubkey()),
            &[payer],
            svm.latest_blockhash(),
        )
    }

    fn svm() -> LiteSVM {
        let mut svm = LiteSVM::new();
        svm.add_program(
            PROGRAM_ID,
            include_bytes!("../../../target/deploy/result_registry.so"),
        )
        .expect("program loads into LiteSVM");
        svm
    }

    #[test]
    fn submits_an_immutable_result_record() {
        let mut svm = svm();
        let authority = Keypair::new();
        svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
        let args = standard_args();
        let result = result_pda(&authority.pubkey(), &args);

        svm.send_transaction(signed_tx(
            &authority,
            submit_ix(&authority.pubkey(), &result, &args),
            &svm,
        ))
        .unwrap();

        let account = svm.get_account(&result).expect("result account exists");
        assert_eq!(account.owner, PROGRAM_ID);
        assert_eq!(account.data.len(), 164);
    }

    #[test]
    fn rejects_a_submission_without_the_authority_signature() {
        let mut svm = svm();
        let authority = Keypair::new();
        let attacker = Keypair::new();
        svm.airdrop(&attacker.pubkey(), LAMPORTS_PER_SOL).unwrap();
        let args = standard_args();
        let result = result_pda(&authority.pubkey(), &args);

        let mut transaction = Transaction::new_with_payer(
            &[submit_ix(&authority.pubkey(), &result, &args)],
            Some(&attacker.pubkey()),
        );
        transaction.partial_sign(&[&attacker], svm.latest_blockhash());

        assert!(svm.send_transaction(transaction).is_err());
        assert!(svm.get_account(&result).is_none());
    }

    #[test]
    fn rejects_invalid_score_and_schema_version() {
        let mut svm = svm();
        let authority = Keypair::new();
        svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();

        let mut invalid_score = standard_args();
        invalid_score.total_score = 10_001;
        let result = result_pda(&authority.pubkey(), &invalid_score);
        assert!(svm
            .send_transaction(signed_tx(
                &authority,
                submit_ix(&authority.pubkey(), &result, &invalid_score),
                &svm,
            ))
            .is_err());

        let mut invalid_schema = standard_args();
        invalid_schema.schema_version = 2;
        invalid_schema.run_nonce = 8;
        let result = result_pda(&authority.pubkey(), &invalid_schema);
        assert!(svm
            .send_transaction(signed_tx(
                &authority,
                submit_ix(&authority.pubkey(), &result, &invalid_schema),
                &svm,
            ))
            .is_err());
    }
}
