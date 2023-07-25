## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT
extends Node

var window # iframe 창
var add_todo_func = JavaScript.create_callback(self, 'add_todo')
var remove_todo_func = JavaScript.create_callback(self, 'remove_todo')


# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	# 구성 폴더가 없으면 폴더 생성
	var dir:= Directory.new()
	if not dir.dir_exists('user://todo/'):
		dir.make_dir('user://todo/')
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	$Todos/Todo_Add.global_position = window_size / 2
	$Todos/Todo_Add.global_position
	if dir.open('user://todo/') == OK:
		dir.list_dir_begin(true, true)
		var ls = dir.get_next()
		while ls:
			var file:= File.new()
			var err:= file.open('user://todo/%s/info.todo' % ls, File.READ)
			if err == OK: # 혹시 완료된 일인지도 검토
				if not dir.file_exists('user://todo/%s/done.todo' % ls):
					add_todo([file.get_as_text()])
			file.close()
			ls = dir.get_next()
		dir.list_dir_end()
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.add_todo = add_todo_func
		window.remove_todo = remove_todo_func
	else: # 엔진에서 테스트중일 때
		print_debug('on test...')
	greater_gravity_at_start()


var gravity_value:= 3860
const GRAVITY_TARGET:= 2240
func greater_gravity_at_start():
	yield(get_tree(), "idle_frame")
	$Todos/Area2D.gravity = gravity_value
	gravity_value -= 32
	if gravity_value > GRAVITY_TARGET:
		greater_gravity_at_start()
	else:
		gravity_value = GRAVITY_TARGET
		$Todos/Area2D.gravity = gravity_value


var ele_0:= preload("res://TodoEle_0.tscn")
var ele_1:= preload("res://TodoEle_1.tscn")
var ele_2:= preload("res://TodoEle_2.tscn")
var have_done:= preload("res://DoneEffect.tscn")
# 해야할 일 추가하기
func add_todo(args):
	var json = JSON.parse(args[0]).result
	if json is Dictionary:
		# 추가하기 구성 변경
		if not $Todos/Todo_Add.visible:
			$EmptyTodo.hide()
			$Todos/Todo_Add.visible = true
			$Todos/Todo_Add.global_position = window_size / 2
			$Todos/Todo_Add.sleeping = true
		var new_todo # 해야할 일 정보
		yield(get_tree(), "idle_frame")
		yield(get_tree(), "idle_frame")
		# 기존에 가지고 있는 해야할 일인지 정보 검토
		var children:= $Todos/TodoElements.get_children()
		var check_exist:= false
		var checked_node
		for child in children:
			if child.name == json.id:
				checked_node = child
				check_exist = true
				break
		var checked_position:Vector2
		if check_exist:
			checked_node.name = 'will_remove'
			checked_position = checked_node.global_position
			checked_node.queue_free()
		if json.has('done') and json.done:
			if check_exist:
				var inst:= have_done.instance()
				inst.name = 'have_done'
				inst.global_position = checked_position
				add_child(inst)
			# 마지막으로 할 일을 완료한 경우 토글
			if children.size() <= 1:
				$EmptyTodo.show()
				$Todos/Todo_Add.visible = false
				$Todos/Todo_Add.global_position = window_size / 2
				$Todos/Todo_Add.sleeping = true
			return # 완료된 일은 개체를 생성하지 않음
		match(json.importance):
			'0': # 메모
				new_todo = ele_0.instance()
				new_todo.line_color = Color('#bb888888')
				new_todo.normal_color = Color('#88888888')
				new_todo.alert_color = Color('#8800bbbb')
				new_todo.lerp_start_from = .8
			'1': # 기억해야함
				new_todo = ele_1.instance()
				new_todo.line_color = Color('#bbdddd0c')
				new_todo.normal_color = Color('#88888888')
				new_todo.alert_color = Color('#88dddd0c')
				new_todo.lerp_start_from = .5
			'2': # 중요함
				new_todo = ele_2.instance()
				new_todo.line_color = Color('#bb880000')
				new_todo.normal_color = Color('#88dddd0c')
				new_todo.alert_color = Color('#88880000')
				new_todo.lerp_start_from = .4
		# 필수 정보 입력
		new_todo.name = json.id
		new_todo.info = json
		# 랜덤한 위치에서 생성
		var max_dist:float = $Todos/Area2D/CollisionShape2D.shape.radius
		randomize()
		$Todos/Area2D/GenerateHere.position = Vector2(max_dist - (50 + randf() * 75), 0)
		$Todos/Area2D.rotation = deg2rad(randf() * 720 - 360)
		new_todo.position = $Todos/Area2D/GenerateHere.global_position
		$Todos/TodoElements.add_child(new_todo)
	else: printerr('json import error')

# 해야할 일 개체 삭제
func remove_todo(args):
	var json = JSON.parse(args[0]).result
	if json is Dictionary:
		var new_todo # 해야할 일 정보
		# 기존에 가지고 있는 해야할 일인지 정보 검토
		var children:= $Todos/TodoElements.get_children()
		for child in children:
			if child.name == json.id:
				child.name = 'will_remove'
				child.queue_free()
				break
		# 추가하기 구성 변경
		if children.size() <= 1:
			$EmptyTodo.show()
			$Todos/Todo_Add.visible = false
			$Todos/Todo_Add.global_position = window_size / 2
			$Todos/Todo_Add.global_position
	else: printerr('json import error')


func _on_Add_gui_input(event):
	if event is InputEventMouseButton:
		if not event.pressed and event.button_index == 1:
			if window:
				window.add_todo_menu()
			else:
				print_debug('editor test add todo')
				add_todo([JSON.print({
					'id': 'engine_test_id',
					'title': '엔진_test_title',
					'written': OS.get_system_time_msecs(),
					'limit': OS.get_system_time_msecs() + 10000,
					'importance': '0',
					'logs': [],
					'description': 'test_desc',
					'remote': null,
					'attach': {},
				})])


# Control 노드를 이용한 화면 크기 검토용
var window_size:Vector2
const GEN_MARGIN:= 600
var current_time:int
# add-todo-menu.p5timer.AlertLerpStartFrom
func _process(_delta):
	current_time = OS.get_system_time_msecs()
	window_size = $Todos.rect_size
	$Todos/Area2D.position = window_size / 2
	$Todos/Area2D/CollisionShape2D.shape.radius = window_size.x + GEN_MARGIN if window_size.x > window_size.y else window_size.y + GEN_MARGIN
