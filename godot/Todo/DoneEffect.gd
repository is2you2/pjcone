## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT


extends Node2D


func _ready():
	yield(get_tree().create_timer($CPUParticles2D.lifetime - .1), "timeout")
	queue_free()
