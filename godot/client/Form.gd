extends Node

# iframe 창
var window

# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		# ionic에게 IndexedDB가 생성되었음을 알림
		window.parent['godot'] = 'godot';
		# 행동 방침 가져오기
		var act:String = window.act
		if not act: # 아무런 요청도 없이 프레임만 불러온 경우
			printerr('Godot: 행동 정보가 비어있음')
		else: load_package(act)
	else: # 엔진에서 테스트중일 때
		var test_act:= 'godot-debug'
		load_package(test_act)

# 동작하려는 pck 정보 불러오기
func load_package(act_name:String):
	var is_loaded:= ProjectSettings.load_resource_pack('user://acts/%s.pck' % act_name)
	if not is_loaded: # 없으면 다운받기
		printerr('Godot: 패키지를 불러오지 못함: ', act_name)
		var dir:= Directory.new()
		if not dir.dir_exists('user://acts/'):
			dir.make_dir('user://acts/')
		if OS.has_feature('JavaScript'):
			if not $CenterContainer/ColorRect.is_connected("gui_input", self, '_on_Label_gui_input'):
				$CenterContainer/ColorRect.connect("gui_input", self, '_on_Label_gui_input')
	else: # 패키지를 가지고 있는 경우
		print('Godot: 패키지 타겟: ', act_name)
		$CenterContainer.queue_free()
		var inst = load('res://Main.tscn')
		add_child(inst.instance())

# 파일 다운로드 시작
func start_download_pck(args = null):
	var act_name:= 'godot-debug'
	if OS.has_feature('JavaScript'):
		act_name = window.act
	var req:= HTTPRequest.new()
	req.name = 'HTTPRequest'
	req.download_file = 'user://acts/%s.pck' % act_name
	req.connect("request_completed", self, '_on_HTTPRequest_request_completed')
	req.use_threads = true
	$CenterContainer.add_child(req)
	var err:= req.request('https://is2you2.github.io/pjcone_pck/%s.pck' % act_name)
	if err != OK:
		if OS.has_feature('JavaScript'):
			window.failed()
		else:
			printerr('기능 다운로드 실패: ', err)

func _on_HTTPRequest_request_completed(result, response_code, headers, body):
	if response_code == 200:
		if OS.has_feature('JavaScript'):
			load_package(window.act)
		else: # 엔진 내 테스트중
			load_package('godot-debug')
	else: # 목표 파일 다운로드 실패
		if OS.has_feature('JavaScript'):
			window.failed()
		else:
			printerr('기능 다운로드 실패')


func _on_Label_gui_input(event):
	if (event is InputEventMouseButton or event is TouchScreenButton) and event.pressed:
		if OS.has_feature('JavaScript'):
			var _Callback = JavaScript.create_callback(self, 'start_download_pck')
			window['accept'] = _Callback
			window.permit()
		else:
			load_package('godot-debug')
