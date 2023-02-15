## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT
extends Control


onready var target_camera:= $Camera2D


# indexes
var touches:Dictionary = {}
# center, dist
var tmp:Dictionary = {}
# 판넬 움직이기
func _input(event):
	# 터치 시작과 종료
	if event is InputEventScreenTouch or event is InputEventMouseButton:
		var index = 0 if event is InputEventMouseButton else event.index
		if event.pressed: # 등록
			touches[index] = event.position
		else: # 삭제
			touches.erase(index)
			tmp.clear()
		if touches.size() > 2: # 기본값으로 복구
			reset_viewport()
	if event is InputEventScreenDrag or event is InputEventMouseMotion:
		var touches_length:= touches.size()
		var index = 0 if event is InputEventMouseMotion else event.index
		if touches_length == 1: # 패닝
			var last_info:Vector2 = touches[index]
			target_camera.translate(last_info - event.position)
			touches[index] = event.position
		elif touches_length == 2: # 스케일, 패닝
			var last_other:Vector2 = touches[1 if index == 0 else 0]
			var dist:= last_other.distance_to(event.position)
			var center:Vector2 = (last_other + event.position) / 2
			# 사전 등록값이 있을 때만 연산
			if tmp.size():
				target_camera.zoom = tmp['zoom'] * (tmp['dist'] / dist)
				target_camera.translate(tmp['center'] - center)
			tmp['zoom'] = target_camera.zoom
			tmp['center'] = center
			tmp['dist'] = dist
			touches[index] = event.position
		elif touches_length > 2:
			reset_viewport()
	if event is InputEventMouseButton:
		match(event.button_index):
			1, 2: # 좌우 클릭
				pass
			4: # 휠 위로
				wheel_zoom_act(.95)
			5: # 휠 아래로
				wheel_zoom_act(1.1)
			_: # 가운데 클릭 및 기타 버튼
				reset_viewport()


# 마우스 휠: 확대/축소 행동
func wheel_zoom_act(_step:float):
	target_camera.zoom = target_camera.zoom * _step


# 뷰포트 원복
func reset_viewport():
	target_camera.position = Vector2.ZERO
	target_camera.rotation_degrees = 0
	target_camera.zoom = Vector2.ONE
