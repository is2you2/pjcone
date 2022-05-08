local nk = require("nakama")
-- 회원가입시 이메일을 받으면 해당 주소로 인증메일 보내기

local function send_cert_email(context, payload)
    local json = nk.json_decode(payload)
    local send_mail = string.format("echo \"테스트 이메일\n발송입니다.\" | mail -s TestingSendEmail %q", json.email)
    -- 아직 동작 테스트중
    -- ENTRYPOINT ["echo Hello World"]
    nk.logger_info(send_mail)
    return nk.json_encode(json)
end

nk.register_rpc(send_cert_email, "send_cert_email")
