use anchor_lang::prelude::*;

use crate::{
    constants::{PAPER_ASSET_COUNT, PAPER_CONFIG_SEED, PAPER_MARKET_SEED},
    errors::ResultRegistryError,
    state::{PaperExchange, PaperMarket},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigurePaperMarketArgs {
    pub asset: u8,
    pub feed_id: [u8; 32],
}

#[derive(Accounts)]
#[instruction(args: ConfigurePaperMarketArgs)]
pub struct ConfigurePaperMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [PAPER_CONFIG_SEED], bump = exchange.bump, has_one = admin @ ResultRegistryError::UnauthorizedPaperAdmin)]
    pub exchange: Account<'info, PaperExchange>,
    #[account(
        init,
        payer = admin,
        space = PaperMarket::SPACE,
        seeds = [PAPER_MARKET_SEED, &[args.asset]],
        bump,
    )]
    pub market: Account<'info, PaperMarket>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ConfigurePaperMarket>, args: ConfigurePaperMarketArgs) -> Result<()> {
    require!((args.asset as usize) < PAPER_ASSET_COUNT, ResultRegistryError::InvalidPaperAsset);
    require!(args.feed_id != [0; 32], ResultRegistryError::InvalidPaperOracle);
    let market = &mut ctx.accounts.market;
    market.asset = args.asset;
    market.feed_id = args.feed_id;
    market.bump = ctx.bumps.market;
    Ok(())
}
