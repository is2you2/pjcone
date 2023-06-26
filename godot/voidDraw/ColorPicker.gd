extends Control


var selectedColor:Color
var is_init_value:= true


func _on_ColorPicker_visibility_changed():
	if visible:
		is_init_value = true
		var children:= $ColorBar.get_children()
		for child in children:
			child.texture.gradient.set_color(1, Color.white)
		$SelectColor.texture.gradient.set_color(0, selectedColor)
		$AnimationPlayer.play("Init")


func _on_ColorPicker_gui_input(event):
	if event is InputEventScreenDrag:
		var control_center:= rect_size / 2
		if event.position.y < control_center.y:
			# 채도 조절
			var sat:float
			var dist:float = $Center.rect_position.distance_to(event.position)
			sat = clamp(float_map(dist, 50, 134, 0, 1), 0,1 )
			# 색상 조절
			var hue:float = 0
			var angle:float = rad2deg($Center.rect_position.angle_to_point(event.position))
			hue = clamp(float_map(angle, 30, 150, 0, 1), 0, 1)
			# 적용하기
			var current:Color = $SelectColor.texture.gradient.get_color(0)
			current.h = hue
			current.s = sat
			if is_init_value:
				current.v = 1
			selectedColor = current
			$SelectColor.texture.gradient.set_color(0, current)


func float_map(value, InputA, InputB, OutputA, OutputB):
	return (value - InputA) / (InputB - InputA) * (OutputB - OutputA) + OutputA


func _on_Brightness_gui_input(event):
	if event is InputEventScreenDrag:
		change_value(1 - event.position.x / 191.0)


func change_value(v:float):
	var children:= $ColorBar.get_children()
	for child in children:
		child.texture.gradient.set_color(1, Color(v, v, v))
	var current:Color = $SelectColor.texture.gradient.get_color(0)
	current.v = v
	is_init_value = false
	selectedColor = current
	$SelectColor.texture.gradient.set_color(0, current)
