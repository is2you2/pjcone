local nk = require("nakama")


local function query_all_users(context, payload)
    local query = [[
  SELECT username, display_name, create_time
  FROM users
  ORDER BY create_time DESC
]]

    local parameters = {}
    local rows = nk.sql_query(query, parameters)

    local users = {}
    for i, row in ipairs(rows) do
        users[i] = { username = row.username, display_name = row.display_name, create_time = row.create_time }
    end

    return nk.json_encode(users)
end

nk.register_rpc(query_all_users, "query_all_users")
