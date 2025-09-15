import pygame

# Initialize pygame and joystick subsystem
pygame.init()
pygame.joystick.init()

# Detect joysticks
if pygame.joystick.get_count() == 0:
    print("No joystick detected.")
    exit()

joystick = pygame.joystick.Joystick(0)
joystick.init()

print(f"Detected joystick: {joystick.get_name()} with {joystick.get_numaxes()} axes and {joystick.get_numbuttons()} buttons")

# Event loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

        # Axis motion
        if event.type == pygame.JOYAXISMOTION:
            x_axis = joystick.get_axis(0)  # left/right
            y_axis = joystick.get_axis(1)  # up/down
            print(f"Axis: X={x_axis:.2f}, Y={y_axis:.2f}")

        # Button press
        if event.type == pygame.JOYBUTTONDOWN:
            print(f"Button {event.button} pressed")
        if event.type == pygame.JOYBUTTONUP:
            print(f"Button {event.button} released")

        # Hat (D-pad)
        if event.type == pygame.JOYHATMOTION:
            print(f"D-pad: {event.value}")
