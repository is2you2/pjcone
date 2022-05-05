local nk = require("nakama")
-- 회원가입시 이메일을 받으면 해당 주소로 인증메일 보내기

local function send_cert_email(context, payload)
    nk.logger_info(string.format("Payload: %q", payload))
    -- "payload" is bytes sent by the client we'll JSON decode it.
    local json = nk.json_decode(payload)
    return nk.json_encode(json)
end

nk.register_rpc(send_cert_email, "send_cert_email")
