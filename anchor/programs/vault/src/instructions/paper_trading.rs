//! Virtual portfolio accounts for the private paper-trading ER.  These
//! instructions deliberately never receive token accounts or invoke SPL Token.
use anchor_lang::prelude::*;
use crate::{
    constants::*, errors::ResultRegistryError,
    state::{PaperMarket, PaperMarketRegistry, PaperOrder, PaperPosition, PaperSession},
};

fn active_actor(session: &PaperSession, actor: Pubkey) -> Result<()> {
    require!(session.status == PaperSession::ACTIVE, ResultRegistryError::PaperSessionNotActive);
    require!(
        actor == session.authority || (actor == session.session_signer && Clock::get()?.unix_timestamp <= session.expires_at),
        ResultRegistryError::UnauthorizedPaperSessionActor
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePaperMarketRegistry<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(init, payer = authority, space = PaperMarketRegistry::SPACE, seeds = [PAPER_REGISTRY_SEED], bump)]
    pub registry: Account<'info, PaperMarketRegistry>,
    pub system_program: Program<'info, System>,
}
pub fn initialize_registry(ctx: Context<InitializePaperMarketRegistry>) -> Result<()> {
    ctx.accounts.registry.authority = ctx.accounts.authority.key();
    ctx.accounts.registry.schema_version = PAPER_SCHEMA_VERSION;
    ctx.accounts.registry.bump = ctx.bumps.registry;
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpsertPaperMarketArgs {
    pub market_id: [u8; 16], pub oracle_feed: [u8; 32], pub lot_size: u64,
    pub price_multiplier: u32, pub half_spread_bps: u16, pub depth_lots: u64, pub enabled: bool,
}
#[derive(Accounts)]
#[instruction(args: UpsertPaperMarketArgs)]
pub struct UpsertPaperMarket<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(has_one = authority @ ResultRegistryError::UnauthorizedPaperRegistryAuthority)] pub registry: Account<'info, PaperMarketRegistry>,
    #[account(init_if_needed, payer = authority, space = PaperMarket::SPACE, seeds = [PAPER_MARKET_SEED, registry.key().as_ref(), args.market_id.as_ref()], bump)]
    pub market: Account<'info, PaperMarket>,
    pub system_program: Program<'info, System>,
}
pub fn upsert_market(ctx: Context<UpsertPaperMarket>, args: UpsertPaperMarketArgs) -> Result<()> {
    require!(args.market_id != [0;16] && args.oracle_feed != [0;32] && args.lot_size > 0 && args.price_multiplier > 0 && args.depth_lots > 0, ResultRegistryError::InvalidPaperOrder);
    let market = &mut ctx.accounts.market;
    market.registry = ctx.accounts.registry.key(); market.market_id = args.market_id;
    market.oracle_feed = args.oracle_feed; market.lot_size = args.lot_size;
    market.price_multiplier = args.price_multiplier; market.half_spread_bps = args.half_spread_bps;
    market.depth_lots = args.depth_lots; market.enabled = args.enabled; market.bump = ctx.bumps.market;
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializePaperSessionArgs { pub session_signer: Pubkey, pub run_nonce: u64, pub expires_at: i64 }
#[derive(Accounts)]
#[instruction(args: InitializePaperSessionArgs)]
pub struct InitializePaperSession<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    pub registry: Account<'info, PaperMarketRegistry>,
    #[account(init, payer = authority, space = PaperSession::SPACE, seeds = [PAPER_SESSION_SEED, authority.key().as_ref(), &args.run_nonce.to_le_bytes()], bump)]
    pub session: Account<'info, PaperSession>,
    pub system_program: Program<'info, System>,
}
pub fn initialize_session(ctx: Context<InitializePaperSession>, args: InitializePaperSessionArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(args.session_signer != Pubkey::default() && args.expires_at > now && args.expires_at <= now + PAPER_MAX_SESSION_SECONDS, ResultRegistryError::UnauthorizedPaperSessionActor);
    let session = &mut ctx.accounts.session;
    session.authority = ctx.accounts.authority.key(); session.session_signer = args.session_signer;
    session.registry = ctx.accounts.registry.key(); session.available_usdc_cents = PAPER_STARTING_USDC_CENTS;
    session.reserved_usdc_cents = 0; session.realized_pnl_cents = 0; session.next_order_id = 0;
    session.expires_at = args.expires_at; session.status = PaperSession::ACTIVE;
    session.schema_version = PAPER_SCHEMA_VERSION; session.bump = ctx.bumps.session; Ok(())
}

#[derive(Accounts)]
pub struct OpenPaperPosition<'info> {
    #[account(mut)] pub actor: Signer<'info>,
    #[account(mut)] pub session: Account<'info, PaperSession>,
    #[account(constraint = market.registry == session.registry @ ResultRegistryError::PaperMarketUnavailable, constraint = market.enabled @ ResultRegistryError::PaperMarketUnavailable)] pub market: Account<'info, PaperMarket>,
    #[account(init, payer = actor, space = PaperPosition::SPACE, seeds = [PAPER_POSITION_SEED, session.key().as_ref(), market.key().as_ref()], bump)] pub position: Account<'info, PaperPosition>,
    pub system_program: Program<'info, System>,
}
pub fn open_position(ctx: Context<OpenPaperPosition>) -> Result<()> {
    active_actor(&ctx.accounts.session, ctx.accounts.actor.key())?;
    let p = &mut ctx.accounts.position; p.session = ctx.accounts.session.key(); p.market = ctx.accounts.market.key();
    p.quantity_lots = 0; p.reserved_lots = 0; p.inventory_cost_cents = 0; p.bump = ctx.bumps.position; Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlacePaperLimitOrderArgs { pub side: u8, pub price_cents: u64, pub quantity_lots: u64 }
#[derive(Accounts)]
#[instruction(args: PlacePaperLimitOrderArgs)]
pub struct PlacePaperLimitOrder<'info> {
    #[account(mut)] pub actor: Signer<'info>,
    #[account(mut)] pub session: Account<'info, PaperSession>,
    #[account(constraint = market.registry == session.registry @ ResultRegistryError::PaperMarketUnavailable, constraint = market.enabled @ ResultRegistryError::PaperMarketUnavailable)] pub market: Account<'info, PaperMarket>,
    #[account(mut, seeds = [PAPER_POSITION_SEED, session.key().as_ref(), market.key().as_ref()], bump = position.bump, constraint = position.session == session.key() && position.market == market.key() @ ResultRegistryError::InvalidPaperOrderAccount)] pub position: Account<'info, PaperPosition>,
    #[account(init, payer = actor, space = PaperOrder::SPACE, seeds = [PAPER_ORDER_SEED, session.key().as_ref(), &session.next_order_id.to_le_bytes()], bump)] pub order: Account<'info, PaperOrder>,
    pub system_program: Program<'info, System>,
}
pub fn place_limit_order(ctx: Context<PlacePaperLimitOrder>, args: PlacePaperLimitOrderArgs) -> Result<()> {
    active_actor(&ctx.accounts.session, ctx.accounts.actor.key())?;
    require!((args.side == PaperOrder::BUY || args.side == PaperOrder::SELL) && args.price_cents > 0 && args.quantity_lots > 0, ResultRegistryError::InvalidPaperOrder);
    let notional = args.price_cents.checked_mul(args.quantity_lots).ok_or(ResultRegistryError::InvalidPaperOrder)? / 1_000;
    let session = &mut ctx.accounts.session; let position = &mut ctx.accounts.position;
    if args.side == PaperOrder::BUY { require!(session.available_usdc_cents >= notional, ResultRegistryError::InsufficientVirtualFunds); session.available_usdc_cents -= notional; session.reserved_usdc_cents += notional; }
    else { require!(position.quantity_lots >= 0 && (position.quantity_lots as u64).saturating_sub(position.reserved_lots) >= args.quantity_lots, ResultRegistryError::InsufficientVirtualFunds); position.reserved_lots += args.quantity_lots; }
    let order = &mut ctx.accounts.order; order.session = session.key(); order.market = ctx.accounts.market.key(); order.id = session.next_order_id; order.side = args.side; order.price_cents = args.price_cents; order.remaining_lots = args.quantity_lots; order.reserved_cents = if args.side == PaperOrder::BUY { notional } else { 0 }; order.status = PaperOrder::OPEN; order.bump = ctx.bumps.order; session.next_order_id += 1; Ok(())
}

#[derive(Accounts)]
pub struct CancelPaperOrder<'info> {
    #[account(mut)] pub actor: Signer<'info>, #[account(mut)] pub session: Account<'info, PaperSession>,
    #[account(mut)] pub position: Account<'info, PaperPosition>,
    #[account(mut, seeds = [PAPER_ORDER_SEED, session.key().as_ref(), &order.id.to_le_bytes()], bump = order.bump, constraint = order.session == session.key() && order.market == position.market @ ResultRegistryError::InvalidPaperOrderAccount)] pub order: Account<'info, PaperOrder>,
}
pub fn cancel_order(ctx: Context<CancelPaperOrder>) -> Result<()> {
    active_actor(&ctx.accounts.session, ctx.accounts.actor.key())?;
    let order = &mut ctx.accounts.order; require!(order.status == PaperOrder::OPEN, ResultRegistryError::InvalidPaperOrderAccount);
    if order.side == PaperOrder::BUY { ctx.accounts.session.available_usdc_cents += order.reserved_cents; ctx.accounts.session.reserved_usdc_cents -= order.reserved_cents; }
    else { ctx.accounts.position.reserved_lots -= order.remaining_lots; }
    order.status = PaperOrder::CANCELLED; order.remaining_lots = 0; order.reserved_cents = 0; Ok(())
}
