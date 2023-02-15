## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT

extends Node

# iframe 창
var window

# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	get_tree().connect("files_dropped", self, 'load_package_debug')
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		# ionic에게 IndexedDB가 생성되었음을 알림
		window.parent['godot'] = 'godot';
		var dir:= Directory.new()
		if not dir.dir_exists('user://acts/'):
			dir.make_dir('user://acts/')
		# 행동 방침 가져오기
		var act:String = window.act
		$CenterContainer/ColorRect/Label.text = 'Click to download\n"%s" tool.' % window.title
		if not act: # 아무런 요청도 없이 프레임만 불러온 경우
			printerr('Godot: 행동 정보가 비어있음')
		else: load_package(act)
	else: # 엔진에서 테스트중일 때
		var test_act:= 'godot-debug'
		load_package(test_act)

# pck 투척시 테스트를 위해 바로 받아보기
func load_package_debug(files:PoolStringArray, scr):
	var target:String
	for file in files:
		if file.find('.pck') + 1:
			target = file
			break
	var is_loaded:= ProjectSettings.load_resource_pack(target)
	if not is_loaded: # 불러오기 실패
		printerr('Godot: 패키지를 불러오지 못함: ', target)
	else: # 정상적으로 불러와짐
		$CenterContainer.queue_free()
		print('Godot-debug: 패키지 타겟: ', target)
		var inst = load('res://Main.tscn')
		add_child(inst.instance())
	get_tree().disconnect("files_dropped", self, 'load_package_debug')

# 동작하려는 pck 정보 불러오기
func load_package(act_name:String):
	var is_loaded:= ProjectSettings.load_resource_pack('user://acts/%s.pck' % act_name)
	if not is_loaded: # 없으면 다운받기
		printerr('Godot: 패키지를 불러오지 못함: ', act_name)
		if not $CenterContainer/ColorRect.is_connected("gui_input", self, '_on_Label_gui_input'):
			$CenterContainer/ColorRect.connect("gui_input", self, '_on_Label_gui_input')
	else: # 패키지를 가지고 있는 경우
		print('Godot: 패키지 타겟: ', act_name)
		$CenterContainer.queue_free()
		var inst = load('res://%s.tscn' % (window.title if window.title else 'Main'))
		add_child(inst.instance())
		if get_tree().is_connected("files_dropped", self, 'load_package_debug'):
			get_tree().disconnect("files_dropped", self, 'load_package_debug')

# 파일 다운로드 시작
func start_download_pck():
	var act_name:= 'godot-debug'
	if OS.has_feature('JavaScript'):
		act_name = window.act
	$CenterContainer/ColorRect/Label.text = 'Downloading...\n"%s" tool.' % window.title
	var req:= HTTPRequest.new()
	req.name = 'HTTPRequest'
	req.download_file = 'user://acts/%s.pck' % act_name
	req.connect("request_completed", self, '_on_HTTPRequest_request_completed')
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
		$CenterContainer/ColorRect/Label.text = 'Click to download\n"%s" tool.' % window.title
		if OS.has_feature('JavaScript'):
			window.failed()
		else:
			printerr('기능 다운로드 실패')


func _on_Label_gui_input(event):
	if event is InputEventMouseButton or event is InputEventScreenTouch:
		if event.pressed:
			if OS.has_feature('JavaScript'):
				start_download_pck()
			else:
				start_download_pck()
