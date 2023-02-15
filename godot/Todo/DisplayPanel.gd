## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT
extends Control


onready var target_camera:= get_node('..')
onready var parent_control:= get_node('../../..') # Todos


var start_position:Vector2
var target_position:Vector2
var is_pressed:= false
# 판넬 움직이기
func _on_DisplayPanel_gui_input(event):
	if event is InputEventMouseMotion:
		if is_pressed:
			target_position = event.position
	if event is InputEventMouseButton:
		if event.pressed:
			start_position = event.position
			target_position = event.position
			origin_position = target_camera.position
			is_pressed = true
		else: # 손 떼기
			is_pressed = false
			target_camera.position = origin_position + (start_position - target_position)

# 원래 위치
var origin_position:Vector2
func _process(delta):
	rect_size = parent_control.rect_size
	rect_position = -rect_size / 2
	if is_pressed:
		target_camera.position = origin_position + (start_position - target_position)
