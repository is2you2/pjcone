local nk = require("nakama")

function match_init(context, params)
  local state = {}
  local tick_rate = 1
  local label = "QRShare"
  return state, tick_rate, label
end

local function match_join(context, dispatcher, tick, state, presences)
  return state
end

local function match_join_attempt(context, dispatcher, tick, state, presence, metadata)
  return state, true
end

local function match_leave(context, dispatcher, tick, state, presences)
  return state
end

function match_loop(context, dispatcher, tick, state, messages)
  return state
end

local function match_signal(context, dispatcher, tick, state, data)
  return state, "signal received: " .. data
end

local function match_terminate(context, dispatcher, tick, state, grace_seconds)
  return state
end

return {
  match_init = match_init,
  match_join_attempt = match_join_attempt,
  match_join = match_join,
  match_leave = match_leave,
  match_loop = match_loop,
  match_terminate = match_terminate,
  match_signal = match_signal
}
