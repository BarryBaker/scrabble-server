# scrabble_bot.py
import sys
import numpy as np


def calculate_best_move(board, rack):
    # For now, we'll return a simple placeholder
    return {"word": "TEST", "row": 7, "col": 7, "direction": "horizontal"}


if __name__ == "__main__":
    # Parse input from Node.js
    board_str = sys.argv[
        1
    ]  # Board is passed as a string (e.g., a serialized JSON array)
    rack_str = sys.argv[2]  # Rack is passed as a string (e.g., "A,B,C,D,E,F,G")

    # Convert inputs back into Python structures
    board = np.array(eval(board_str))  # Using eval here is simplistic, use with caution
    rack = rack_str.split(",")

    # Calculate the best move
    best_move = calculate_best_move(board, rack)

    # Return the result to Node.js
    print(best_move)
