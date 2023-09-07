local nk = require("nakama")

local function manage_todo_add(context, payload)
    local json = nk.json_decode(payload)

    -- 첨부파일 간소화
    if #json.attach == 0 then
        json.attach = nil
    end

    -- 매니저의 정보 저장
    local object = {
        {
            collection = 'server_todo',
            key = json.id,
            user_id = json.remote.creator_id,
            value = json,
            permission_read = 2,
            permission_write = 1
        },
    }
    nk.storage_write(object)

    local workers_json = nk.json_decode(payload)
    if #workers_json.attach == 0 then
        workers_json.attach = nil
    end
    workers_json.workers = nil
    -- 작업자들 정보 생성
    for i in ipairs(json.workers) do
        local _object = {
            {
                collection = 'server_todo',
                key = json.id,
                user_id = json.workers[i].id,
                value = workers_json,
                permission_read = 2,
                permission_write = 1
            },
        }
        nk.storage_write(_object)
    end
end

nk.register_rpc(manage_todo_add, "manage_todo_add_fn")
