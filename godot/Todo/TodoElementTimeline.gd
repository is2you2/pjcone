extends Control


var parent_node


func _ready():
	parent_node = get_node("../../..")


func _draw():
	draw_arc(size / 2, size.x / 2 - 3, deg_to_rad(-90), deg_to_rad(lerp(-90, 270, parent_node.lerp_value)), lerp(8, 36, parent_node.lerp_value), parent_node.line_color, 6, true)
