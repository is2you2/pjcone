extends Node
# 사용자 관리 서버


var server:= WebSocketServer.new()
const PORT:= 12001
const HEADER:= 'Account'
# 토큰별 사용자 관리
# { token: { pid: [SingleAct.peer, ..] } }
var token:= {}


func _ready():
    server.connect('client_connected', self, '_connected')
    server.connect('client_disconnected', self, '_disconnected')
    server.connect('client_close_request', self, '_disconnected')
    server.connect('data_received', self, '_received')


func _connected(id:int, _proto:= 'EMPTY'):
    pass


func _disconnected(id:int, _was_clean = null, _reason:= 'EMPTY'):
    pass


func _received(id:int, _try_left:= 5):
    var err:= server.get_peer(id).get_packet_error()
    if err == OK:
        var raw_data:= server.get_peer(id).get_packet()
        var data:= raw_data.get_string_from_utf8()
        var json = JSON.parse(data).result
        if json is Dictionary:
            pass
        else:
            pass
    else:
        if _try_left > 0:
            Root.logging(HEADER, str('send packet error with try left: ', _try_left))
            yield(get_tree(), "idle_frame")
            _received(id, _try_left -1)
        else:
            Root.logging(HEADER, str('receive packet try left out.'), Root.LOG_ERR)
            server.disconnect_peer(id, 1011, 'receive try left out')


func send_to(id:int, msg:PoolByteArray, _try_left:= 5):
    var err:=server.get_peer(id).put_packet(msg)
    if err != OK:
        if _try_left > 0:
            Root.logging(HEADER, str('send packet error with _try_left: ', _try_left))
            yield(get_tree(), "idle_frame")
            send_to(id, msg, _try_left -1)
        else:
            Root.logging(HEADER, str('send packet try left out.'), Root.LOG_ERR)
            server.disconnect_peer(id, 1011, 'send try left out')


func _exit_tree():
    server.stop()