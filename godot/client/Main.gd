extends Node


# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _init():
	if OS.has_feature('JavaScript'):
		var window = JavaScript.get_interface('window')
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


func _process(_delta):
	$CenterContainer/ColorRect/Label.text = str(OS.get_ticks_msec())


func load_package(act_name:String):
	var is_loaded:= ProjectSettings.load_resource_pack('user://acts/%s.pck' % act_name)
	if not is_loaded:
		printerr('Godot: 패키지를 올바르게 불러오지 못함: ', act_name)
	else:
		print('Godot: 패키지 타겟: ', act_name)
