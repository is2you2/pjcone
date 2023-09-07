local nk = require("nakama")

local function manage_todo_delete(context, payload)
    local json = nk.json_decode(payload)

    -- 작업자들 정보 삭제
    for i in ipairs(json.workers) do
        local object = {
            {
                collection = 'server_todo',
                key = json.id,
                user_id = json.workers[i].id,
            }
        }
        pcall(nk.storage_delete, object)
    end
end

nk.register_rpc(manage_todo_delete, "manage_todo_delete_fn")
