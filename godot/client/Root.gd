extends Node


# iframe 창
var window

# 이 함수를 등록하지 말고 인 게임에서 오버라이딩이 필요한 함수를 직접 구성해야 합니다
var ws_recv_func = JavaScriptBridge.create_callback(ws_recv)
var webrtc_recv_func = JavaScriptBridge.create_callback(webrtc_recv)

# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	if OS.has_feature('web'):
		window = JavaScriptBridge.get_interface('window')
		window.ws_recv = ws_recv_func
		window.webrtc_recv = webrtc_recv_func

# ArcadeWS 를 통해서 메시지를 수신받음 (Sample)
func ws_recv(args):
	var recv_str:String = args[0]
	print('ws_msg received: ', recv_str)

# ArcadeWS 를 사용하여 메시지 발송하기
func ws_send(str: String):
	if OS.has_feature('web') and window.ws_send:
		window.ws_send(str)

# WebRTC 동시 연동시 수신받는 메시지
func webrtc_recv(args):
	var recv_str:String = args[0]
	print('webrtc_msg received: ', recv_str)

# ArcadeWS 를 사용하여 메시지 발송하기
func webrtc_send(str: String):
	if OS.has_feature('web') and window.webrtc_send:
		window.webrtc_send(str)
