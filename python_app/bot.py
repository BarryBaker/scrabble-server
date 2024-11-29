# scrabble_bot.py
import sys
import numpy as np
import json
import bisect

import os
from initial_board import initial_board
import time
import copy
from itertools import permutations
import time


def qw(*a):
    print(a, file=sys.stderr)


def t():
    return time.time()


cwd = os.getcwd()

with open(f"{cwd}/wordlist.txt", "r") as file:
    words = [
        line.strip() for line in file.readlines()
    ]  # Pad words to a max length of 15 for consistency


def inlist(word, words):
    index = bisect.bisect_left(words, word)  # Find the insertion point
    # Check if the word exists at the found index
    return index < len(words) and words[index] == word


def check_other_word_validity(board, letter, is_column, invalid):

    board_copy = copy.deepcopy(board)

    row_index = letter[1]
    col_index = letter[2]
    if is_column:
        row = board_copy[row_index]
        row[col_index] = letter[0]
        start = col_index
        end = col_index
    else:
        columns_copy = list(zip(*board_copy))
        row = list(columns_copy[col_index])
        row[row_index] = letter[0]
        start = row_index
        end = row_index

    # Update the chosen element with a letter at the specified position
    # print(row)
    # row[col_index] = letter[0]

    # Find all consecutive non-empty letters in the row, including the newly added letter
    # start = col_index
    # end = col_index

    # Move left to find the start of the word
    while start > 0 and row[start - 1] != "":
        start -= 1

    # Move right to find the end of the word
    while end < len(row) - 1 and row[end + 1] != "":
        end += 1

    # Get the word formed
    word_formed = "".join(row[start : end + 1])

    # if len(word_formed) > 1:

    #     qw("     ", word_formed, invalid)
    # qw("     ", inlist(word_formed, invalid))
    #     qw(
    #         len(word_formed) == 1
    #         or (inlist(word_formed, words) and not inlist(word_formed, invalid))
    #     )
    # qw(
    #     len(word_formed) == 1
    #     or (inlist(word_formed, words) and not inlist(word_formed, invalid)),
    #     inlist(word_formed, invalid),
    # )
    return len(word_formed) == 1 or (
        inlist(word_formed, words) and not word_formed in invalid
    )


def calculate_space_around_groups(row_letters):
    result = {}
    groups = []
    current_group = []

    # Identify groups of consecutive letters
    for i, letter in enumerate(row_letters):
        if letter != "":
            current_group.append((letter, i))
        else:
            if current_group:
                groups.append(current_group)
                current_group = []

    if current_group:
        groups.append(current_group)

    # Calculate spaces around each group
    for group in groups:
        group_letters = "".join([letter for letter, _ in group])
        first_index = group[0][1]
        last_index = group[-1][1]

        # Calculate spaces before the group
        spaces_before = 0
        for j in range(first_index - 1, -1, -1):
            if row_letters[j] == "":
                spaces_before += 1
            else:
                spaces_before = max(0, spaces_before - 1)  # Stop before the next letter
                break

        # Calculate spaces after the group
        spaces_after = 0
        for j in range(last_index + 1, len(row_letters)):
            if row_letters[j] == "":
                spaces_after += 1
            else:
                spaces_after = max(0, spaces_after - 1)  # Stop before the next letter
                break

        # Adjust spaces before and after to ensure we leave one space before any neighboring letter
        if first_index > 0 and row_letters[first_index - 1] != "":
            spaces_before = max(0, spaces_before - 1)
        if last_index < len(row_letters) - 1 and row_letters[last_index + 1] != "":
            spaces_after = max(0, spaces_after - 1)

        # Add the group and its before/after spaces and the index of the first letter as a tuple in the dictionary
        result[group_letters] = (spaces_before, spaces_after, first_index)

    return result


def words_for_lettergroup(
    board,
    origi_word,
    letters,
    before_max,
    after_max,
    index_of_origi_word,
    is_column,
    line_number,
    invalid,
):  # word is lettergroup (1 or more length)
    result = []

    def extend_word(filtered_words, word, letters, before, after):
        # print(word, letters, before, after, file=sys.stderr)
        # time.sleep(0.05)
        for l in letters:
            for orient in range(2):
                if orient == 0 and before > 0:
                    new_word = l + word
                elif orient == 1 and after > 0:
                    new_word = word + l
                else:
                    continue

                # if new_word in filtered_words:
                # elapsed_time_task_1 = time.time() - start_time
                # print(f"Task 1 took {elapsed_time_task_1:.4f} seconds") time.time()
                # if len(invalid) > 0:
                #     qw(invalid, new_word, inlist(new_word, invalid))
                if inlist(new_word, filtered_words) and not new_word in invalid:

                    put_before = before_max - before + (orient == 0)
                    put_after = len(new_word) - len(origi_word) - put_before
                    start = index_of_origi_word - put_before
                    end = index_of_origi_word + len(origi_word)

                    new_word_details = (
                        new_word,
                        start,
                        tuple(
                            [
                                (
                                    (new_word[i], start + i, line_number)
                                    if is_column
                                    else (new_word[i], line_number, start + i)
                                )
                                for i in range(put_before)
                            ]
                            + [
                                (
                                    (
                                        new_word[-(i + 1)],
                                        end + put_after - i - 1,
                                        line_number,
                                    )
                                    if is_column
                                    else (
                                        new_word[-(i + 1)],
                                        line_number,
                                        end + put_after - i - 1,
                                    )
                                )
                                for i in reversed(range(put_after))
                            ]
                        ),
                    )
                    # qw(new_word)
                    stillgood = True
                    for check_letter in new_word_details[2]:

                        # qw(check_letter)
                        if not check_other_word_validity(
                            board, check_letter, is_column, invalid
                        ):
                            stillgood = False
                            break

                    # if all(
                    #     check_other_word_validity(
                    #         board, check_letter, is_column, invalid
                    #     )
                    #     for check_letter in new_word_details[2]
                    # ):
                    if stillgood:
                        result.append(new_word_details)
                    # else:
                    #     print("nemjo", new_word_details)
                # st = time.time()
                possible_words = [
                    i
                    for i in filtered_words
                    if new_word in i and len(i) > len(new_word)
                ]
                # qw(time.time() - st)
                # qw("aaaaa")
                # time.sleep(0.002)

                if len(possible_words) > 0:
                    if orient == 0:
                        new_before = before - 1
                        new_after = after
                    else:
                        new_before = before
                        new_after = after - 1

                    if new_before + new_after > 0:
                        new_letters = letters.copy()
                        new_letters.remove(l)
                        extend_word(
                            possible_words,
                            new_word,
                            new_letters,
                            new_before,
                            new_after,
                        )

    extend_word(words, origi_word, letters, before_max, after_max)
    # result = list(set(result))
    # result = sorted(result, key=lambda x: (x[0], x[1]))
    # result = [(i[0], i[2]) for i in result]
    # for i in result:
    #     print(i)
    return result


def main(board, letters, invalid):

    result = []
    board_has_letters = any(any(cell != "" for cell in row) for row in board)
    if not board_has_letters:
        final = []
        setwords = set(words)
        for length in range(2, len(letters) + 1):
            for combo in permutations(letters, length):
                candidate_word = "".join(combo)
                if candidate_word in setwords:
                    final.append(candidate_word)
        final = list(set(final))
        for i in final:
            result.append(tuple([i, tuple([(l, 7, 7 + n) for n, l in enumerate(i)])]))
    else:
        columns = list(zip(*board))

        for i in range(len(board)):
            for orient in range(2):

                row_letters = [board[i], columns[i]][orient]
                lettergroups = calculate_space_around_groups(row_letters)
                for lg in lettergroups:
                    result.extend(
                        words_for_lettergroup(
                            board,
                            lg,
                            letters,
                            lettergroups[lg][0],
                            lettergroups[lg][1],
                            lettergroups[lg][2],
                            orient,
                            i,
                            invalid,
                        )
                    )
                # qw(time.time() - st, i, orient)
        result = list(set(result))
        result = sorted(result, key=lambda x: (x[0]))
        result = [(i[0], i[2]) for i in result]
    result = [[i[0], [list(j) for j in i[1]]] for i in result]
    # print(result)

    return result


# for i in result:
#     print(i)


if __name__ == "__main__":

    st = t()
    aa = inlist("QUEER", words)
    print((t() - st) * 1000)

    st = t()
    bb = "QUEER" in words
    print((t() - st) * 1000)

    st = t()
    cc = [i for i in words if "QUEER" in i]
    print((t() - st) * 1000)
    print(len(cc))
    board_str = sys.argv[1]  # Board is passed as a JSON string
    letters_str = sys.argv[2]  # Rack is passed as a JSON string
    invalid_str = sys.argv[3]
    # Deserialize JSON to Python objects
    board = json.loads(board_str)
    letters = json.loads(letters_str)
    invalid = json.loads(invalid_str)
    # board = [
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [
    #         "",
    #         "",
    #         "",
    #         "",
    #         "",
    #         "",
    #         "",
    #         "B",
    #         "A",
    #         "B",
    #         "O",
    #         "S",
    #         "E",
    #         "",
    #         "",
    #     ],
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    #     [""] * 15,
    # ]

    # letters = ["Q", "A", "E", "U", "S", "S", "T", "B"]
    # invalid = []

    result = main(board, letters, invalid)
    # Convert result to a JSON string
    result_json = json.dumps(result)
    qw("after", time.time() - st)

    # Return the JSON string
    print(result_json)  # This will be captured as stdout by Node.js
