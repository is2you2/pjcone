local nk = require("nakama")

local function remove_account(context, payload)
    nk.account_delete_id(context.user_id, true)
  end
  
  nk.register_rpc(remove_account, "remove_account_fn")
