local nk = require("nakama")

local function remove_account(context, payload)
  local json = nk.json_decode(payload)
  nk.account_delete_id(json.user_id, true)
end

nk.register_rpc(remove_account, "remove_account_fn")
