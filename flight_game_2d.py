import pygame
import sys

# --- Setup ---
pygame.init()
pygame.joystick.init()

# Check for joystick
if pygame.joystick.get_count() == 0:
    print("No joystick detected.")
    sys.exit()
joystick = pygame.joystick.Joystick(0)
joystick.init()

# Window
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Joystick Flight Simulator")

# Colors
WHITE = (255, 255, 255)
BLUE = (50, 150, 255)

# Plane (simple triangle shape)
plane_size = 40
plane = pygame.Surface((plane_size, plane_size), pygame.SRCALPHA)
pygame.draw.polygon(plane, (200, 0, 0), [(20, 0), (0, 40), (40, 40)])

# Plane state
x, y = WIDTH // 2, HEIGHT // 2
speed = 2.0
angle = 0.0

clock = pygame.time.Clock()

# --- Main Loop ---
while True:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()

    # Read joystick axes
    x_axis = joystick.get_axis(0)   # left/right
    y_axis = joystick.get_axis(1)   # up/down

    # Throttle (button 0)
    throttle = 1.0
    if joystick.get_button(0):
        throttle = 2.0   # boost speed when button pressed

    # Update position
    x += x_axis * speed * throttle
    y += y_axis * speed * throttle

    # Keep inside screen
    x = max(0, min(WIDTH, x))
    y = max(0, min(HEIGHT, y))

    # Clear screen
    screen.fill(BLUE)

    # Rotate plane sprite toward direction of stick
    if abs(x_axis) > 0.1 or abs(y_axis) > 0.1:
        import math
        angle = math.degrees(math.atan2(-y_axis, x_axis)) - 90
    rotated = pygame.transform.rotate(plane, angle)
    rect = rotated.get_rect(center=(x, y))

    # Draw plane
    screen.blit(rotated, rect.topleft)

    # Draw HUD (debug info)
    font = pygame.font.SysFont(None, 24)
    text = font.render(f"X={x_axis:.2f} Y={y_axis:.2f} Throttle={'ON' if throttle > 1 else 'OFF'}", True, WHITE)
    screen.blit(text, (10, 10))

    pygame.display.flip()
    clock.tick(60)
