extends Node
# 채팅 릴레이 서버
# 사용자간 채팅을 위한 릴레이 서버, 


var server:= WebSocketServer.new()
const HEADER:= 'ChatServer'
const PORT:= 12011


# 연결된 사용자 { pid: { token } }
var users:= {}
# 구성된 그룹 { gid: { users: [uid], title, last_msg } }
var groups:= {}


func _ready():
    server.connect('client_connected', self, '_connected')
    server.connect('client_disconnected', self, '_disconnected');
    server.connect('client_close_request', self, '_disconnected')
    server.connect('data_received', self, '_received')


func _connected(id:int, proto:= 'NULL'):
    pass

func _disconnected(id:int, was_clean = null, reason:= 'NULL'):
    pass

func _received(id:int):
    pass

func send_to(id:int, msg:PoolByteArray):
    pass

func send_except(id:int, msg:PoolByteArray):
    pass

func send_to_all(msg:PoolByteArray):
    pass

func _process(_delta):
    server.poll()

func _exit_tree():
    server.stop()