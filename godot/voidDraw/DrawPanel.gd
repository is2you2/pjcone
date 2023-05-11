extends ColorRect


export var width:= 432
export var height:= 432

# 캔버스 시작 크기에 따른 자동 가운데 위치
var origin_position:= Vector2(0, 0)
# 캔버스 시작 크기와 화면에 따른 기본 배율
var origin_scale:= 1.0

func _ready():
	rect_size = Vector2(width, height)
	rect_pivot_offset = rect_size / 2
	var viewport_rect:= get_viewport_rect().size
	origin_position = -rect_pivot_offset + viewport_rect / 2
	rect_position = origin_position
	var width_ratio:float = viewport_rect.x / rect_size.x
	var height_ratio:float = viewport_rect.y / rect_size.y
	origin_scale = min(width_ratio, height_ratio)
	var anim:Animation = $AnimationPlayer.get_animation("NewPanel")
	anim.track_set_key_value(0, 1, [origin_scale, -.25, 0, .25, 0])
	anim.track_set_key_value(1, 1, [origin_scale, -.25, 0, .25, 0])
	$AnimationPlayer.play("NewPanel")
