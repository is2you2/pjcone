## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT
extends Control


onready var target_camera:= get_node('..')
onready var parent_control:= get_node('../../..') # Todos


var start_position:Vector2
var target_position:Vector2
var origin_position:Vector2
var is_pressed:= false
# 판넬 움직이기
func _on_DisplayPanel_gui_input(event):
	if event is InputEventScreenDrag:
		pass
	if event is InputEventMouseMotion:
		if is_pressed:
			target_position = event.position
	if event is InputEventScreenTouch:
		pass
	if event is InputEventMouseButton:
		match(event.button_index):
			1: # 좌클릭
				if event.pressed:
					start_position = event.position
					target_position = event.position
					origin_position = target_camera.position
					is_pressed = true
				else: # 손 떼기
					is_pressed = false
					target_camera.position = origin_position + (start_position - target_position)
			2: # 우클릭
				if event.pressed:
					reset_viewport()
			3: # 가운데 클릭
				if event.pressed:
					reset_viewport()
			4: # 휠 올리기
				wheel_zoom_act(.95)
			5: # 휠 내리기
				wheel_zoom_act(1.1)


# 마우스 휠: 확대/축소 행동
func wheel_zoom_act(_step:float):
	target_camera.zoom = target_camera.zoom * _step


# 뷰포트 원복
func reset_viewport():
	target_camera.position = Vector2.ZERO
	target_camera.rotation_degrees = 0
	target_camera.zoom = Vector2.ONE


func _process(delta):
	rect_size = parent_control.rect_size * target_camera.zoom
	rect_position = -rect_size / 2
	if is_pressed:
		target_camera.position = origin_position + (start_position - target_position)
