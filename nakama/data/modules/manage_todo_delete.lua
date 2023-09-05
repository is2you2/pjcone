local nk = require("nakama")

local function manage_todo_delete(context, payload)
    local json = nk.json_decode(payload)
end

nk.register_rpc(manage_todo_delete, "manage_todo_delete_fn")
