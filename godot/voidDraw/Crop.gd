extends ColorRect


onready var parent:ViewportContainer = get_node('..')
const UI_LINE_RATIO:= 5.0

# Crop UI
func _draw():
	draw_rect(Rect2(Vector2.ZERO, rect_size), Color('#abf') if parent.control == 2 else Color.brown, false, UI_LINE_RATIO / parent.rect_scale.x)
	var width:= rect_size.x
	var height:= rect_size.y
	var mid_hori:float = lerp(0, width, .8)
	var mid_vert:float = lerp(0, height, .8)
	var guide_color:= Color('#ff0')
	draw_line(Vector2(width, mid_vert), Vector2(width, height), guide_color, UI_LINE_RATIO / parent.rect_scale.x)
	draw_line(Vector2(mid_hori, height), Vector2(width, height), guide_color, UI_LINE_RATIO / parent.rect_scale.x)


var last_resize_pos:Vector2

func _on_Crop_gui_input(event):
	if event is InputEventMouseButton or event is InputEventScreenTouch:
		if event.pressed:
			var dist:float = rect_size.distance_to(event.position)
			var side:= max(rect_size.x, rect_size.y)
			if dist < side / 3:
				parent.control = 2
				last_resize_pos = event.position
		else:
			parent.control = 1
			update()
	if event is InputEventMouseMotion or event is InputEventScreenDrag:
		if parent.control == 2:
			var diff:Vector2 = last_resize_pos - event.position
			rect_size = rect_size - diff
			last_resize_pos = event.position
