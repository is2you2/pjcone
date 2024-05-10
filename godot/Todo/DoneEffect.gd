extends Node2D


func _ready():
	yield(get_tree().create_timer($CPUParticles2D.lifetime - .1), "timeout")
	queue_free()
